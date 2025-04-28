const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const OpenAI = require('openai');
const functions = require('firebase-functions');
const fetch = require('node-fetch');
const xml2js = require('xml2js');

// Define secrets
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');
const sendgridFromEmail = defineSecret('SENDGRID_FROM_EMAIL');
const sendgridTemplateId = defineSecret('SENDGRID_TEMPLATE_ID');
const sendgridPremiumTemplateId = defineSecret('SENDGRID_PREMIUM_TEMPLATE_ID');
const openaiApiKey = defineSecret('OPENAI_API_KEY');

// Initialize Express app
const app = express();

// Middleware
app.use(cors({origin: true}));
app.use(express.json());

// Initialize Firebase Admin
admin.initializeApp();

// Configuration constants
const CONFIG = {
  MAX_DISTANCE_KM: process.env.MAX_DISTANCE_KM || 100,
  DEFAULT_SKILL_FOCUS: "Practice your bottom turns and cutbacks",
  DEFAULT_DAILY_CHALLENGE: "Try to catch at least 5 waves today",
  CHECKIN_URLS: {
    yes: "https://kook-cast.com/surf-diary/new",
    no: "https://kook-cast.com/surf-diary/new",
    skipped: "https://kook-cast.com/surf-diary/new"
  }
};

// Utility functions
function formatLocation(location) {
  if (!location) return 'Unknown Location';
  return location
    .split(/[-\s]/)  // Split on both hyphens and spaces
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Email service is running' });
});

// Test endpoint to check scheduled email functionality
app.post('/test-scheduled', async (req, res) => {
  try {
    console.log('[TEST] Testing scheduled email functionality');
    
    // Get all verified users
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('emailVerified', '==', true)
      .get();
    
    const userCount = usersSnapshot.size;
    const usersWithLocation = usersSnapshot.docs.filter(doc => doc.data().surfLocation).length;
    
    // Get today's date in LA timezone
    const laDate = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const today = new Date(laDate);
    const dateKey = today.toISOString().split('T')[0];
    
    // Get lock status
    const lockRef = admin.firestore().collection('locks').doc('premiumReports');
    const lockDoc = await lockRef.get();
    const lockData = lockDoc.data();
    
    // Calculate next run time (5 AM PT)
    const nextRun = new Date(laDate);
    nextRun.setHours(5, 0, 0, 0);
    if (nextRun < today) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    res.json({
      status: 'success',
      message: 'Email system check complete',
      stats: {
        total_verified_users: userCount,
        users_with_locations: usersWithLocation,
        next_scheduled_run: nextRun.toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles'
        }),
        current_time: today.toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles'
        }),
        lock_status: {
          exists: lockDoc.exists,
          date: lockData?.date,
          state: lockData?.state,
          last_run: lockData?.lastRun,
          today: dateKey,
          should_run: !(lockData?.date === dateKey && lockData?.state === 'completed')
        }
      }
    });
  } catch (error) {
    console.error('[TEST_ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check email system',
      error: error.message
    });
  }
});

// Test endpoint to check lock status
app.get('/check-lock', async (req, res) => {
  try {
    const lockRef = admin.firestore().collection('locks').doc('premiumReports');
    const lockDoc = await lockRef.get();
    const lockData = lockDoc.data();
    
    const laDate = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const today = new Date(laDate);
    const dateKey = today.toISOString().split('T')[0];
    
    res.json({
      status: 'success',
      lock_status: {
        exists: lockDoc.exists,
        date: lockData?.date,
        state: lockData?.state,
        last_run: lockData?.lastRun,
        today: dateKey,
        should_run: !(lockData?.date === dateKey && lockData?.state === 'completed')
      }
    });
  } catch (error) {
    console.error('[LOCK_CHECK_ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check lock status',
      error: error.message
    });
  }
});

// Test endpoint to manually trigger the function
app.post('/trigger-scheduled', async (req, res) => {
  try {
    const lockRef = admin.firestore().collection('locks').doc('premiumReports');
    const lockDoc = await lockRef.get();
    const lockData = lockDoc.data();
    
    const laDate = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const today = new Date(laDate);
    const dateKey = today.toISOString().split('T')[0];
    
    // Check if already run today
    if (lockData?.date === dateKey && lockData?.state === 'completed') {
      return res.json({
        status: 'skipped',
        message: 'Function already completed today',
        lock_data: lockData
      });
    }
    
    // Set lock to running
    await lockRef.set({
      date: dateKey,
      state: 'running',
      lastRun: admin.firestore.FieldValue.serverTimestamp(),
      instanceId: Math.random().toString(36).substring(7)
    });
    
    // Get all premium users with emailVerified = true
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('emailVerified', '==', true)
      .where('premium', '==', true)
      .get();
    
    console.log(`[PREMIUM_REPORTS] Found ${usersSnapshot.size} premium users`);

    const sendGridApiKey = sendgridApiKey.value();
    const fromEmail = sendgridFromEmail.value();
    const premiumTemplateId = sendgridPremiumTemplateId.value();
    const openAiApiKey = openaiApiKey.value();

    sgMail.setApiKey(sendGridApiKey);

    // Process each premium user
    let successCount = 0;
    let errorCount = 0;
    const processedUsers = new Set();
    
    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data() || {};
      const userId = userDoc.id;
      
      // Skip if already processed
      if (processedUsers.has(userId)) {
        console.log(`[PREMIUM_REPORTS] Skipping already processed user ${userId}`);
        continue;
      }
      processedUsers.add(userId);
      
      try {
        // Get user data with defaults
        const userData = await getUserData(userId);
        
        // Skip if no surf locations
        if (!userData.surfLocations || userData.surfLocations.length === 0) {
          console.log(`[SKIP_PREMIUM_USER] User ${user.email} has no surf locations set`);
          continue;
        }

        // Get up to 5 surf locations
        const locations = userData.surfLocations.slice(0, 5);
        
        // Process all locations in parallel
        console.log(`[PROCESSING_PREMIUM_USER] Generating reports for ${user.email} - ${locations.length} locations`);
        const startTime = Date.now();
        
        const spotReports = await Promise.all(
          locations.map(async (location) => {
            if (!location) return null;
            console.log(`[PROCESSING_LOCATION] ${user.email} - ${location}`);
            return generateSurfReport(
              location, 
              userData.surferType, 
              userId, 
              openAiApiKey, 
              userData
            );
          })
        );

        const endTime = Date.now();
        console.log(`[PROCESSING_TIME] Took ${endTime - startTime}ms to process ${locations.length} locations`);

        // Filter out any null results
        const validReports = spotReports.filter(report => report !== null);
        console.log(`[VALID_REPORTS] Generated ${validReports.length} valid reports`);

        // Find the best spot based on skill match percentage
        const bestSpot = validReports.reduce((best, current) => {
          const currentMatch = parseInt(current.skill_match.replace('%', ''));
          const bestMatch = parseInt(best.skill_match.replace('%', ''));
          return currentMatch > bestMatch ? current : best;
        }, validReports[0]);

        // Format the featured spot
        const featuredSpot = {
          name: bestSpot.spot_name,
          highlight: bestSpot.match_summary,
          reason: bestSpot.match_conditions,
          wave: bestSpot.wave_height,
          conditions: bestSpot.conditions,
          skill: bestSpot.skill_match,
          board: bestSpot.best_board,
          air: bestSpot.air_temp,
          cloud: bestSpot.clouds,
          rain: bestSpot.rain_chance,
          wind: bestSpot.wind_description,
          water: bestSpot.water_temp,
          wetsuit: bestSpot.gear,
          best_time: bestSpot.prime_time,
          alt_time: bestSpot.backup_time,
          tip1: bestSpot.tip1,
          tip2: bestSpot.tip2,
          tip3: bestSpot.tip3,
          tide: bestSpot.weatherData?.current?.buoyData?.tide || 'No tide data available'
        };

        // Format remaining spots
        const otherSpots = validReports
          .filter(spot => spot.spot_name !== bestSpot.spot_name)
          .map(spot => ({
            name: spot.spot_name,
            highlight: spot.match_summary,
            wave: spot.wave_height,
            conditions: spot.conditions,
            skill: spot.skill_match,
            board: spot.best_board,
            best_time: spot.prime_time,
            alt_time: spot.backup_time,
            tide: spot.weatherData?.current?.buoyData?.tide || 'No tide data available'
          }));

        // Prepare template data
        const templateData = {
          user_name: user.displayName || 'Surfer',
          featured_spot: featuredSpot,
          spots: otherSpots,
          total_spots: validReports.length,
          diary_url: "https://kook-cast.com/diary/new-session",
          subject: `${featuredSpot.name} is looking 🔥 today!`
        };

        // Send ONE premium email
        console.log(`[SENDING_EMAIL] Sending single email to ${user.email} with ${validReports.length} locations`);
        const emailResult = await sgMail.send({
          to: user.email,
          from: {
            email: fromEmail,
            name: "KookCast"
          },
          subject: `${featuredSpot.name} is looking 🔥 today!`,
          templateId: premiumTemplateId,
          dynamicTemplateData: templateData
        });

        // Verify email was sent successfully
        if (!emailResult || !emailResult[0]?.statusCode === 202) {
          throw new Error('Failed to send email');
        }

        console.log(`[EMAIL_SENT] Successfully sent email to ${user.email}`);
        successCount++;
      } catch (error) {
        console.error(`[USER_ERROR] Failed to process user ${user.email}:`, error);
        errorCount++;
        
        // Update user's status in Firestore
        try {
          await admin.firestore()
            .collection('users')
            .doc(userId)
            .update({
              lastEmailError: error.message,
              lastEmailAttempt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (updateError) {
          console.error(`[UPDATE_ERROR] Failed to update user status for ${user.email}:`, updateError);
        }
      }
    }

    // Update lock with completion status
    await lockRef.update({
      state: 'completed',
      successCount,
      errorCount,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      status: 'success',
      message: 'Function triggered successfully',
      stats: {
        total_users: usersSnapshot.size,
        success_count: successCount,
        error_count: errorCount
      }
    });
  } catch (error) {
    console.error('[TRIGGER_ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to trigger function',
      error: error.message
    });
  }
});

// Email sending endpoint
app.post('/send', async (req, res) => {
  try {
    console.log(`[EMAIL_REQUEST] Sending email to: ${req.body.to}, Location: ${req.body.location || 'N/A'}`);
    // Get secrets inside the handler
    const apiKey = sendgridApiKey.value();
    const fromEmail = sendgridFromEmail.value();
    const templateId = sendgridTemplateId.value();
    const openAiKey = openaiApiKey.value();

    if (!apiKey || !fromEmail) {
      throw new Error('SendGrid configuration is missing');
    }

    // Set up SendGrid
    sgMail.setApiKey(apiKey);

    // Validate request
    if (!req.body.to) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required field: to'
      });
    }

    let templateData = req.body.templateData;
    let msg;

    // If location is provided, generate AI report
    if (req.body.location) {
      try {
        console.log(`[AI_REPORT] Generating surf report for ${req.body.location}`);
        const surfReport = await generateSurfReport(req.body.location, req.body.surferType, req.body.userId, req.body.apiKey, req.body.userData);
        console.log(`[AI_REPORT] Successfully generated report for ${req.body.location}`);
        
        const formattedLocation = formatLocation(surfReport.location);
        const subject = `Go surf at ${surfReport.prime_time} at ${formattedLocation}`;

        // Determine condition emoji based on skill match percentage
        const skillMatch = parseInt(surfReport.skill_match.replace('%', ''));
        const conditionEmoji = skillMatch >= 75 ? '🟢' : 
                             skillMatch >= 50 ? '🟡' : '🔴';

        console.log(`[EMAIL_SUBJECT] Subject line: ${subject}`);

        // Create weather context for AI interpretation
        const weatherContext = {
          current: {
            temperature: Math.round((surfReport.weatherData.current.temperature * 9/5) + 32),
            windSpeed: surfReport.weatherData.current.windSpeed,
            windDirection: surfReport.weatherData.current.windDirection,
            waterTemperature: surfReport.weatherData.current.buoyData?.waterTemperature ? 
              Math.round((surfReport.weatherData.current.buoyData.waterTemperature * 9/5) + 32) : null,
            waveHeight: surfReport.weatherData.current.buoyData?.waveHeight,
            swellPeriod: surfReport.weatherData.current.buoyData?.swellPeriod,
            tide: surfReport.weatherData.current.buoyData?.tide,
            cloudCover: surfReport.weatherData.current.cloudCover,
            precipitation: surfReport.weatherData.current.precipitation
          },
          today: {
            maxTemp: Math.round((surfReport.weatherData.today.maxTemp * 9/5) + 32),
            minTemp: Math.round((surfReport.weatherData.today.minTemp * 9/5) + 32),
            maxWindSpeed: surfReport.weatherData.today.maxWindSpeed
          }
        };

        // Add formatted date
        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

        try {
          // Generate descriptive text using OpenAI
          const openai = new OpenAI({ apiKey: openAiKey });
          const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
              {
                role: "system",
                content: `You are an experienced surf coach with decades of experience teaching surfers of all levels. 
                Your tone is warm, encouraging, and deeply knowledgeable. You write as if you're personally guiding each surfer, 
                using phrases like "I've been watching the conditions" and "I think you'll love this spot today." 
                You're incredibly kind and supportive, always finding the positive in any conditions while being honest about challenges.
                
                Consider the user's profile and history:
                Surfing Style: ${req.body.userData?.surferType || 'intermediate'}
                Skill Level: ${req.body.userData?.skillLevel || 'intermediate'}
                Preferred Conditions: ${req.body.userData?.preferredConditions?.join(', ') || 'none specified'}
                Goals: ${req.body.userData?.goals?.join(', ') || 'none specified'}
                
                User's surfboards: ${req.body.userData?.userBoards || 'No boards available'}
                
                Recent surf sessions:
                ${req.body.userData?.recentSessions || 'No recent sessions'}
                
                Last session details:
                ${req.body.userData?.lastSession ? `
                Date: ${req.body.userData.lastSession.date}
                Rating: ${req.body.userData.lastSession.rating}
                Board Used: ${req.body.userData.lastSession.boardUsed}
                Wave Count: ${req.body.userData.lastSession.waveCount}
                Session Duration: ${req.body.userData.lastSession.sessionDuration} minutes
                ` : 'No last session data'}
                
                Average wave count: ${req.body.userData?.averageWaveCount || 0} waves per session
                
                Generate a surf report for ${formattedLocation} on ${formattedDate}. 
                Use ONLY the provided weather data to make your assessment. Do not make up or modify any dates.
                
                For skill matching, consider:
                - The user's surfing style and skill level
                - Their preferred conditions and goals
                - Recent session performance and board usage
                - Current wave conditions
                - Wind conditions
                - Tide conditions
                - Overall difficulty level
                
                For board recommendations, choose from these available boards:
                ${req.body.userData?.userBoards || 'No boards available'}
                
                For each field, generate dynamic content based on the actual data, writing as if you're personally guiding the surfer:
                - spot_name: The name of the surf spot
                - match_summary: One sentence explaining why these conditions match the surfer's skill level and preferences
                - match_conditions: One sentence about the overall conditions matching their style
                - wave_height: Format as "X-Yft • Brief description" (e.g. "4-5ft • Perfect for you")
                - conditions: Brief description of wave quality (e.g. "✨ Clean & Glassy")
                - skill_match: Format as "XX% Compatible" - calculate based on how well conditions match their surf type
                - best_board: Choose from their available boards, format as "X'Y\" BoardType" (e.g. "7'2\" Funboard")
                - air_temp: Format as "XX°F (XX°C)"
                - clouds: Brief description of cloud cover
                - rain_chance: Format as "X%"
                - wind_description: Brief description of wind conditions
                - water_temp: Format as "XX°F (XX°C)"
                - gear: Brief wetsuit recommendation
                - prime_time: Format as "X:XX–X:XXam/pm"
                - prime_notes: Brief note about why this time is good
                - backup_time: Format as "X:XX–X:XXam/pm"
                - backup_notes: Brief note about why this time is good
                - tip1: Specific tip based on conditions and skill level
                - tip2: Specific tip based on conditions and skill level
                - tip3: Specific tip based on conditions and skill level
                - daily_challenge: One specific, achievable challenge based on their goals and recent performance
                - skill_focus: One specific skill to focus on based on their recent sessions
                
                Keep all descriptions brief and to the point. Use imperial measurements:
                - Temperature in Fahrenheit (°F)
                - Wind speed in MPH
                - Wave height in feet (ft)
                
                Format your response as a JSON object with the following structure:
                {
                  "spot_name": "string",
                  "match_summary": "string",
                  "match_conditions": "string",
                  "wave_height": "string",
                  "conditions": "string",
                  "skill_match": "string",
                  "best_board": "string",
                  "air_temp": "string",
                  "clouds": "string",
                  "rain_chance": "string",
                  "wind_description": "string",
                  "water_temp": "string",
                  "gear": "string",
                  "prime_time": "string",
                  "prime_notes": "string",
                  "backup_time": "string",
                  "backup_notes": "string",
                  "tip1": "string",
                  "tip2": "string",
                  "tip3": "string",
                  "daily_challenge": "string",
                  "skill_focus": "string"
                }`
              },
              {
                role: "user",
                content: `Generate a surf report for ${formattedLocation} on ${formattedDate} using this weather data: ${JSON.stringify(weatherContext)}`
              }
            ],
            response_format: { type: "json_object" }
          });

          const weatherDescriptions = JSON.parse(completion.choices[0].message.content);

          // Format template data
          const templateData = {
            spot_name: formattedLocation,
            match_summary: surfReport.match_summary,
            match_conditions: surfReport.match_conditions,
            wave_height: surfReport.wave_height,
            conditions: surfReport.conditions,
            skill_match: surfReport.skill_match,
            best_board: surfReport.best_board,
            air_temp: surfReport.air_temp,
            clouds: surfReport.clouds,
            rain_chance: surfReport.rain_chance,
            wind_description: surfReport.wind_description,
            water_temp: surfReport.water_temp,
            gear: surfReport.gear,
            prime_time: surfReport.prime_time,
            prime_notes: surfReport.prime_notes,
            backup_time: surfReport.backup_time,
            backup_notes: surfReport.backup_notes,
            tip1: surfReport.tip1,
            tip2: surfReport.tip2,
            tip3: surfReport.tip3,
            daily_challenge: surfReport.daily_challenge,
            skill_focus: surfReport.skill_focus,
            diary_url: "https://kook-cast.com/diary/new-session",
            subject: `${conditionEmoji} Go surf at ${surfReport.prime_time} at ${formattedLocation}`
          };

          // Send email
          await sgMail.send({
            to: req.body.to,
            from: {
              email: fromEmail,
              name: "KookCast"
            },
            subject: `${conditionEmoji} Go surf at ${surfReport.prime_time} at ${formattedLocation}`,
            templateId: templateId,
            dynamicTemplateData: templateData
          });

          console.log(`[SUCCESS] Sent report to ${req.body.to} for location ${req.body.location}`);
          
          res.json({
            status: 'success',
            message: 'Email sent successfully'
          });
        } catch (error) {
          console.error(`[ERROR] Error processing user ${req.body.to}:`, error);
          res.status(500).json({
            status: 'error',
            message: 'Failed to send email',
            details: error.response ? error.response.body : error.message
          });
        }
      } catch (error) {
        console.error('Error generating weather descriptions:', error);
        throw new Error('Failed to generate weather descriptions');
      }
    } else {
      msg = {
        to: req.body.to,
        from: {
          email: fromEmail,
          name: "KookCast"
        },
        subject: `Go surf at ${surfReport.best_time} at ${formattedLocation}`,
        templateId: templateId,
        dynamicTemplateData: templateData
      };
    }

    // Send email
    await sgMail.send(msg);
    console.log(`[EMAIL_SENT] Successfully sent email to ${req.body.to}`);
    
    res.json({
      status: 'success',
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('[EMAIL_ERROR] Error sending email:', {
      to: req.body.to,
      location: req.body.location,
      error: error.response ? error.response.body : error.message
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to send email',
      details: error.response ? error.response.body : error.message
    });
  }
});

// Analyze surfer type and determine skill level and recommendations
async function analyzeSurferType(surferType, apiKey) {
  try {
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a surf coach analyzing a surfer's type to determine their skill level and needs.
          Based on the surfer type description, determine:
          1. Skill level (beginner/intermediate/advanced)
          2. Key areas to focus on (with specific, measurable goals)
          3. Appropriate gear recommendations
          4. Suitable challenges (with specific, measurable goals)
          
          Return a JSON object with this structure:
          {
            "skillLevel": "string",
            "focusAreas": [
              {
                "area": "string",
                "metric": "string",
                "target": "string"
              }
            ],
            "gearRecommendations": ["string"],
            "challengeTypes": [
              {
                "type": "string",
                "metric": "string",
                "target": "string"
              }
            ]
          }
          
          Example focus areas:
          - "area": "Paddling", "metric": "Number of waves caught", "target": "Catch 5 waves in a session"
          - "area": "Bottom Turn", "metric": "Success rate", "target": "Execute 3 clean bottom turns"
          
          Example challenge types:
          - "type": "Wave Count", "metric": "Number of waves", "target": "Catch 8 waves in one session"
          - "type": "Timing", "metric": "Seconds", "target": "Paddle out in under 5 minutes"`
        },
        {
          role: "user",
          content: `Analyze this surfer type: ${surferType}`
        }
      ],
      model: "gpt-4"
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error('Error analyzing surfer type:', error);
    throw error;
  }
}

// Weather Data Processing Module
const WeatherProcessor = {
  async fetchMarineData(latitude, longitude) {
    const response = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&hourly=wave_height,swell_wave_height,wind_wave_height,swell_wave_direction,wind_wave_direction,swell_wave_period,swell_wave_peak_period&daily=wave_height_max,swell_wave_height_max,wind_wave_height_max,swell_wave_direction_dominant,wind_wave_direction_dominant,swell_wave_period_max,swell_wave_peak_period_max`
    );
    return response.json();
  },

  async fetchWeatherData(latitude, longitude) {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,precipitation,rain,showers,snowfall,pressure_msl,surface_pressure,cloudcover,cloudcover_low,cloudcover_mid,cloudcover_high,windspeed_10m,winddirection_10m,windgusts_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant&timezone=auto`
    );
    return response.json();
  },

  formatWeatherData(marineData, weatherData, buoyData, currentHourIndex) {
    // Convert wave heights from meters to feet (1m = 3.28084ft)
    const convertToFeet = (meters) => meters ? Math.round(meters * 3.28084 * 10) / 10 : null;
    
    // Convert wind speed from km/h to mph (1km/h = 0.621371mph)
    const convertToMph = (kph) => kph ? Math.round(kph * 0.621371 * 10) / 10 : null;
    
    // Convert temperature from Celsius to Fahrenheit
    const convertToFahrenheit = (celsius) => celsius ? Math.round((celsius * 9/5) + 32) : null;

    return {
      current: {
        waveHeight: convertToFeet(marineData.hourly.wave_height[currentHourIndex]),
        swellHeight: convertToFeet(marineData.hourly.swell_wave_height[currentHourIndex]),
        windWaveHeight: convertToFeet(marineData.hourly.wind_wave_height[currentHourIndex]),
        swellDirection: marineData.hourly.swell_wave_direction[currentHourIndex],
        windWaveDirection: marineData.hourly.wind_wave_direction[currentHourIndex],
        swellPeriod: marineData.hourly.swell_wave_period[currentHourIndex],
        swellPeakPeriod: marineData.hourly.swell_wave_peak_period[currentHourIndex],
        temperature: convertToFahrenheit(weatherData.hourly.temperature_2m[currentHourIndex]),
        windSpeed: convertToMph(weatherData.hourly.windspeed_10m[currentHourIndex]),
        windDirection: weatherData.hourly.winddirection_10m[currentHourIndex],
        windGusts: convertToMph(weatherData.hourly.windgusts_10m[currentHourIndex]),
        buoyData: buoyData ? {
          waterTemperature: convertToFahrenheit(buoyData.data.waterTemperature),
          waveHeight: convertToFeet(buoyData.data.waveHeight),
          wavePeriod: buoyData.data.dominantWavePeriod,
          tide: buoyData.data.tide
        } : null
      },
      today: {
        maxWaveHeight: convertToFeet(marineData.daily.wave_height_max[0]),
        maxSwellHeight: convertToFeet(marineData.daily.swell_wave_height_max[0]),
        maxWindWaveHeight: convertToFeet(marineData.daily.wind_wave_height_max[0]),
        maxTemp: convertToFahrenheit(weatherData.daily.temperature_2m_max[0]),
        minTemp: convertToFahrenheit(weatherData.daily.temperature_2m_min[0]),
        maxWindSpeed: convertToMph(weatherData.daily.windspeed_10m_max[0])
      }
    };
  }
};

// Buoy Data Module
const BuoyData = {
  async findNearestStation(latitude, longitude) {
    const parser = new xml2js.Parser();
    const stationsResponse = await fetch('https://www.ndbc.noaa.gov/activestations.xml');
    const stationsText = await stationsResponse.text();
    const stationsResult = await parser.parseStringPromise(stationsText);
    const stations = stationsResult?.stations?.station || [];
    
    return this.calculateNearestStation(stations, latitude, longitude);
  },

  calculateNearestStation(stations, latitude, longitude) {
    let nearestStation = null;
    let minDistance = Infinity;
    
    stations.forEach(station => {
      if (!station?.lat?.[0] || !station?.lon?.[0]) return;
      
      const stationLat = parseFloat(station.lat[0]);
      const stationLon = parseFloat(station.lon[0]);
      const distance = this.calculateDistance(latitude, longitude, stationLat, stationLon);
      
      if (distance < minDistance && distance <= CONFIG.MAX_DISTANCE_KM) {
        minDistance = distance;
        nearestStation = station;
      }
    });
    
    return { station: nearestStation, distance: minDistance };
  },

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  async fetchStationData(stationId) {
    const response = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${stationId}.txt`);
    const dataText = await response.text();
    return this.parseStationData(dataText);
  },

  parseStationData(dataText) {
    const lines = dataText.split('\n');
    const headers = lines[0].split(/\s+/);
    const data = lines[1].split(/\s+/);
    
    return {
      time: data[0],
      windDirection: parseFloat(data[1]),
      windSpeed: parseFloat(data[2]),
      windGust: parseFloat(data[3]),
      waveHeight: parseFloat(data[4]),
      dominantWavePeriod: parseFloat(data[5]),
      averageWavePeriod: parseFloat(data[6]),
      waveDirection: parseFloat(data[7]),
      seaLevelPressure: parseFloat(data[8]),
      airTemperature: parseFloat(data[9]),
      waterTemperature: parseFloat(data[10]),
      dewPoint: parseFloat(data[11]),
      visibility: parseFloat(data[12]),
      pressureTendency: parseFloat(data[13]),
      tide: parseFloat(data[14])
    };
  }
};

// Surf Report Generation Module
const SurfReportGenerator = {
  async generateReport(location, surferType, apiKey) {
    const coordinates = await getSpotCoordinates(location);
    const currentHourIndex = new Date().getHours();
    
    // Fetch all data in parallel
    const [marineData, weatherData, buoyData] = await Promise.all([
      WeatherProcessor.fetchMarineData(coordinates.latitude, coordinates.longitude),
      WeatherProcessor.fetchWeatherData(coordinates.latitude, coordinates.longitude),
      this.fetchBuoyData(coordinates.latitude, coordinates.longitude)
    ]);
    
    const formattedData = WeatherProcessor.formatWeatherData(
      marineData,
      weatherData,
      buoyData,
      currentHourIndex
    );
    
    return this.generateAIReport(location, formattedData, apiKey);
  },

  async fetchBuoyData(latitude, longitude) {
    try {
      const { station, distance } = await BuoyData.findNearestStation(latitude, longitude);
      if (!station) return null;
      
      const stationData = await BuoyData.fetchStationData(station.id[0]);
      return {
        stationId: station.id[0],
        stationName: station.name[0],
        distance,
        data: stationData
      };
    } catch (error) {
      console.error('Error fetching buoy data:', error);
      return null;
    }
  },

  async generateAIReport(location, weatherData, apiKey, userData = null) {
    const openai = new OpenAI({ apiKey });
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const formattedLocation = formatLocation(location);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are an experienced surf coach with decades of experience teaching surfers of all levels. 
          Your tone is warm, encouraging, and deeply knowledgeable. You write as if you're personally guiding each surfer, 
          using phrases like "I've been watching the conditions" and "I think you'll love this spot today." 
          You're incredibly kind and supportive, always finding the positive in any conditions while being honest about challenges.
          
          Consider the user's profile and history:
          Surfing Style: ${userData?.surferType || 'intermediate'}
          
          User's surfboards: ${userData?.userBoards || 'No boards available'}
          
          Recent surf sessions:
          ${userData?.recentSessions || 'No recent sessions'}
          
          Last session details:
          ${userData?.lastSession ? `
          Date: ${userData.lastSession.date}
          Rating: ${userData.lastSession.rating}
          Had Fun: ${userData.lastSession.hadFun ? 'Yes' : 'No'}
          Description: ${userData.lastSession.description || 'No description'}
          ` : 'No last session data'}
          
          Generate a surf report for ${formattedLocation} on ${formattedDate}. 
          Use ONLY the provided weather data to make your assessment. Do not make up or modify any dates.
          
          For skill matching, consider:
          - The user's surfing style
          - Recent session performance and enjoyment
          - Current wave conditions
          - Wind conditions
          - Tide conditions
          - Overall difficulty level
          
          For board recommendations, choose from these available boards:
          ${userData?.userBoards || 'No boards available'}
          
          For each field, generate dynamic content based on the actual data, writing as if you're personally guiding the surfer:
          - spot_name: The name of the surf spot
          - match_summary: One sentence explaining why these conditions match the surfer's skill level and preferences
          - match_conditions: One sentence about the overall conditions matching their style
          - wave_height: Format as "X-Yft • Brief description" (e.g. "4-5ft • Perfect for you")
          - conditions: Brief description of wave quality (e.g. "✨ Clean & Glassy")
          - skill_match: Format as "XX% Compatible" - calculate based on how well conditions match their surf type
          - best_board: Choose from their available boards, format as "X'Y\" BoardType" (e.g. "7'2\" Funboard")
          - air_temp: Format as "XX°F (XX°C)"
          - clouds: Brief description of cloud cover
          - rain_chance: Format as "X%"
          - wind_description: Brief description of wind conditions
          - water_temp: Format as "XX°F (XX°C)"
          - gear: Brief wetsuit recommendation
          - prime_time: Format as "X:XX–X:XXam/pm"
          - prime_notes: Brief note about why this time is good
          - backup_time: Format as "X:XX–X:XXam/pm"
          - backup_notes: Brief note about why this time is good
          - tip1: Specific tip based on conditions and skill level
          - tip2: Specific tip based on conditions and skill level
          - tip3: Specific tip based on conditions and skill level
          - daily_challenge: One specific, achievable challenge based on their recent performance
          - skill_focus: One specific skill to focus on based on their recent sessions
          
          Keep all descriptions brief and to the point. Use imperial measurements:
          - Temperature in Fahrenheit (°F)
          - Wind speed in MPH
          - Wave height in feet (ft)
          
          Format your response as a JSON object with the following structure:
          {
            "spot_name": "string",
            "match_summary": "string",
            "match_conditions": "string",
            "wave_height": "string",
            "conditions": "string",
            "skill_match": "string",
            "best_board": "string",
            "air_temp": "string",
            "clouds": "string",
            "rain_chance": "string",
            "wind_description": "string",
            "water_temp": "string",
            "gear": "string",
            "prime_time": "string",
            "prime_notes": "string",
            "backup_time": "string",
            "backup_notes": "string",
            "tip1": "string",
            "tip2": "string",
            "tip3": "string",
            "daily_challenge": "string",
            "skill_focus": "string"
          }`
        },
        {
          role: "user",
          content: `Generate a surf report for ${formattedLocation} on ${formattedDate} using this weather data: ${JSON.stringify(weatherData)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const report = JSON.parse(completion.choices[0].message.content);
    
    // Ensure go_today is always a valid value
    const validGoToday = ['yes', 'no', 'maybe'].includes(report.go_today?.toLowerCase()) 
      ? report.go_today.toLowerCase() 
      : 'maybe';

    return {
      ...report,
      location: formattedLocation,
      date: formattedDate,
      go_today: validGoToday
    };
  }
};

// Error Handling and Logging Module
const Logger = {
  logError(error, context) {
    console.error(`[ERROR] ${context}:`, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  },

  logInfo(message, data) {
    console.log(`[INFO] ${message}:`, {
      ...data,
      timestamp: new Date().toISOString()
    });
  },

  logWarning(message, data) {
    console.warn(`[WARNING] ${message}:`, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }
};

// Error Handling Utilities
const ErrorHandler = {
  handleApiError(error, context) {
    Logger.logError(error, `API Error in ${context}`);
    return {
      success: false,
      error: error.message,
      context
    };
  },

  handleDataError(error, context) {
    Logger.logError(error, `Data Processing Error in ${context}`);
    return {
      success: false,
      error: 'Failed to process data',
      context
    };
  },

  handleValidationError(message, context) {
    Logger.logWarning(message, { context });
    return {
      success: false,
      error: message,
      context
    };
  }
};

// Data Validation Module
const Validator = {
  validateLocation(location) {
    if (!location || typeof location !== 'string') {
      return ErrorHandler.handleValidationError(
        'Invalid location format',
        'validateLocation'
      );
    }
    return { success: true };
  },

  validateSurferType(surferType) {
    const validTypes = ['beginner', 'intermediate', 'advanced'];
    if (!validTypes.includes(surferType?.toLowerCase())) {
      return ErrorHandler.handleValidationError(
        'Invalid surfer type',
        'validateSurferType'
      );
    }
    return { success: true };
  },

  validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return ErrorHandler.handleValidationError(
        'Invalid API key format',
        'validateApiKey'
      );
    }
    return { success: true };
  },

  validateWeatherData(weatherData) {
    if (!weatherData || typeof weatherData !== 'object') {
      return ErrorHandler.handleValidationError(
        'Invalid weather data format',
        'validateWeatherData'
      );
    }
    return { success: true };
  }
};

// Rate Limiting and Caching Module
const RateLimiter = {
  requests: new Map(),
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  MAX_REQUESTS: {
    default: 10, // Default rate limit
    premium: 30, // Higher rate limit for premium users
    test: 5, // Lower rate limit for test endpoints
  },
  WINDOW_MS: 60 * 1000, // 1 minute

  async checkRateLimit(ip, userId = null, endpoint = 'default') {
    const now = Date.now();
    const key = userId ? `${userId}:${endpoint}` : `${ip}:${endpoint}`;
    const userRequests = this.requests.get(key) || [];
    
    // Remove old requests
    const recentRequests = userRequests.filter(time => now - time < this.WINDOW_MS);
    
    // Get rate limit based on endpoint
    const maxRequests = this.MAX_REQUESTS[endpoint] || this.MAX_REQUESTS.default;
    
    if (recentRequests.length >= maxRequests) {
      return {
        success: false,
        error: `Rate limit exceeded. Please try again in ${Math.ceil((this.WINDOW_MS - (now - recentRequests[0])) / 1000)} seconds.`
      };
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return { success: true };
  },

  // Clean up old requests periodically
  cleanup() {
    const now = Date.now();
    for (const [key, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(time => now - time < this.WINDOW_MS);
      if (recentRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recentRequests);
      }
    }
  }
};

// Run cleanup every minute
setInterval(() => RateLimiter.cleanup(), 60 * 1000);

const Cache = {
  cache: new Map(),
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  },

  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
};

// Function to get coordinates for surf spots
async function getSpotCoordinates(location) {
  try {
    // Get coordinates from Firestore
    const spotDoc = await admin.firestore()
      .collection('surfSpots')
      .doc(location)
      .get();
    
    if (spotDoc.exists) {
      const spotData = spotDoc.data();
      return {
        latitude: spotData.latitude,
        longitude: spotData.longitude
      };
    }
    
    // Fallback to default location if spot not found
    const defaultSpot = await admin.firestore()
      .collection('surfSpots')
      .doc('venice-beach')
      .get();
      
    if (defaultSpot.exists) {
      const defaultData = defaultSpot.data();
      return {
        latitude: defaultData.latitude,
        longitude: defaultData.longitude
      };
    }
    
    throw new Error('No surf spots found in database');
  } catch (error) {
    console.error('Error getting spot coordinates:', error);
    throw error;
  }
}

// Helper function to get user data with defaults
async function getUserData(userId) {
  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    
    // Get user's surfboards with defaults
    const boardTypes = Array.isArray(userData.surferPreferences?.boardTypes) ? userData.surferPreferences.boardTypes : [];
    const boardLabels = {
      shortboard: 'Shortboard',
      longboard: 'Longboard',
      fish: 'Fish',
      hybrid: 'Hybrid',
      funboard: 'Funboard',
      gun: 'Gun',
      softtop: 'Soft Top',
      foamie: 'Soft-top/Foamie',
      sup: 'SUP'
    };
    const formattedBoards = boardTypes.length > 0 
      ? boardTypes.map(board => boardLabels[board] || board).join(', ')
      : 'No boards selected';

    // Get user's recent diary entries with defaults
    let recentEntries = [];
    try {
      const diaryEntries = await admin.firestore()
        .collection('users')
        .doc(userId)
        .collection('surfEntries')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

      recentEntries = diaryEntries.docs.map(doc => {
        const data = doc.data() || {};
        return {
          date: data.date ? new Date(data.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'Unknown date',
          rating: data.rating || 'decent',
          hadFun: data.hadFun ?? true,
          description: data.description || ''
        };
      });
    } catch (error) {
      console.error('Error fetching diary entries:', error);
      recentEntries = [];
    }

    // Get user's surfing style and preferences
    const surferPreferences = userData.surferPreferences || {};
    const surfingStyle = surferPreferences.description || 'intermediate';

    return {
      userBoards: formattedBoards,
      recentDiaryEntries: recentEntries,
      surferType: surfingStyle,
      surfLocations: Array.isArray(userData.surfLocations) ? userData.surfLocations : [],
      recentSessions: recentEntries.map(entry => 
        `- ${entry.date}: ${entry.rating} (${entry.hadFun ? 'had fun' : 'did not have fun'})${entry.description ? ` - ${entry.description}` : ''}`
      ).join('\n'),
      boardTypes: boardTypes,
      lastSession: recentEntries[0] || null
    };
  } catch (error) {
    console.error('Error getting user data:', error);
    return {
      userBoards: 'No boards selected',
      recentDiaryEntries: [],
      surferType: 'intermediate',
      surfLocations: [],
      recentSessions: '',
      boardTypes: [],
      lastSession: null
    };
  }
}

// Main surf report generation function
async function generateSurfReport(location, surferType, userId, apiKey, userData = null) {
  try {
    console.log('[INFO] Generating surf report:', {
      location,
      surferType,
      userId,
      timestamp: new Date().toISOString()
    });

    // Get user's data from Firestore if not provided
    if (!userData) {
      userData = await getUserData(userId);
    }

    const coordinates = await getSpotCoordinates(location);
    const currentHourIndex = new Date().getHours();
    
    // Fetch all data in parallel
    const [marineData, weatherData, buoyData] = await Promise.all([
      WeatherProcessor.fetchMarineData(coordinates.latitude, coordinates.longitude),
      WeatherProcessor.fetchWeatherData(coordinates.latitude, coordinates.longitude),
      SurfReportGenerator.fetchBuoyData(coordinates.latitude, coordinates.longitude)
    ]);
    
    const formattedData = WeatherProcessor.formatWeatherData(
      marineData,
      weatherData,
      buoyData,
      currentHourIndex
    );
    
    const report = await SurfReportGenerator.generateAIReport(location, formattedData, apiKey, userData);
    
    // Ensure go_today is always included with a valid value
    const validGoToday = ['yes', 'no', 'maybe'].includes(report.go_today?.toLowerCase()) 
      ? report.go_today.toLowerCase() 
      : 'maybe';

    return {
      ...report,
      location: formatLocation(location),
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
      weatherData: formattedData,
      go_today: validGoToday,
      userData
    };
  } catch (error) {
    console.error('[ERROR] API Error in generateSurfReport:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// Scheduled function to send surf reports
exports.sendSurfReports = onSchedule({
  schedule: '0 3 * * *',  // 3 AM Iowa time = 5 AM LA time
  timeZone: 'America/Chicago',  // Iowa timezone
  retryCount: 0,
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridTemplateId, sendgridPremiumTemplateId, openaiApiKey],
  memory: '256MiB'
}, async (event) => {
  try {
    // Get today's date in LA timezone
    const laDate = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const today = new Date(laDate);
    const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Check for existing lock using a transaction
    const lockRef = admin.firestore().collection('locks').doc('regularReports');
    
    const result = await admin.firestore().runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      const lockData = lockDoc.data();
      
      // If lock exists and is from today, skip
      if (lockData?.date === dateKey) {
        console.log('[SCHEDULED_REPORTS] Skipping - already sent today');
        return { shouldRun: false };
      }
      
      // Set new lock with today's date
      transaction.set(lockRef, {
        date: dateKey,
        lastRun: admin.firestore.FieldValue.serverTimestamp(),
        status: 'running'
      });
      
      return { shouldRun: true };
    });

    if (!result.shouldRun) {
      return;
    }

    console.log('[SCHEDULED_REPORTS] Starting daily surf report distribution');
    
    // Get all users with emailVerified = true
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('emailVerified', '==', true)
      .get();
    
    console.log(`[SCHEDULED_REPORTS] Found ${usersSnapshot.size} verified users`);

    const sendGridApiKey = sendgridApiKey.value();
    const fromEmail = sendgridFromEmail.value();
    const templateId = sendgridTemplateId.value();
    const premiumTemplateId = sendgridPremiumTemplateId.value();
    const openAiApiKey = openaiApiKey.value();

    sgMail.setApiKey(sendGridApiKey);

    // Process each user
    let successCount = 0;
    let errorCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data() || {};
      const userId = userDoc.id;
      
      try {
        // Get user data with defaults
        const userData = await getUserData(userId);
        
        // Skip if no surf locations
        if (!userData.surfLocations || userData.surfLocations.length === 0) {
          console.log(`[SKIP_USER] User ${user.email} has no surf locations set`);
          continue;
        }

        // Skip premium users as they are handled by sendPremiumSurfReports
        if (user.premium) {
          console.log(`[SKIP_PREMIUM_USER] User ${user.email} is premium, skipping in sendSurfReports`);
          continue;
        }

        // Regular user flow - only send email for their selected spot
        console.log(`[REGULAR_USER] Processing regular user ${user.email}`);
        
        // Get the first (and only) spot
        const location = userData.surfLocations[0];
        if (!location) {
          console.log(`[SKIP_USER] No surf location found for user ${user.email}`);
          continue;
        }

        // Generate report for the selected spot
        const surfReport = await generateSurfReport(
          location, 
          userData.surferType, 
          userId, 
          openAiApiKey, 
          userData
        );

        const formattedLocation = formatLocation(surfReport.location);
        const subject = `Go surf at ${surfReport.prime_time} at ${formattedLocation}`;

        // Determine condition emoji based on skill match percentage
        const skillMatch = parseInt(surfReport.skill_match.replace('%', ''));
        const conditionEmoji = skillMatch >= 75 ? '🟢' : 
                             skillMatch >= 50 ? '🟡' : '🔴';

        // Format template data
        const templateData = {
          spot_name: formattedLocation,
          match_summary: surfReport.match_summary,
          match_conditions: surfReport.match_conditions,
          wave_height: surfReport.wave_height,
          conditions: surfReport.conditions,
          skill_match: surfReport.skill_match,
          best_board: surfReport.best_board,
          air_temp: surfReport.air_temp,
          clouds: surfReport.clouds,
          rain_chance: surfReport.rain_chance,
          wind_description: surfReport.wind_description,
          water_temp: surfReport.water_temp,
          gear: surfReport.gear,
          prime_time: surfReport.prime_time,
          prime_notes: surfReport.prime_notes,
          backup_time: surfReport.backup_time,
          backup_notes: surfReport.backup_notes,
          tip1: surfReport.tip1,
          tip2: surfReport.tip2,
          tip3: surfReport.tip3,
          daily_challenge: surfReport.daily_challenge,
          skill_focus: surfReport.skill_focus,
          diary_url: "https://kook-cast.com/diary/new-session",
          subject: `${conditionEmoji} Go surf at ${surfReport.prime_time} at ${formattedLocation}`
        };

        // Send ONE regular email
        await sgMail.send({
          to: user.email,
          from: {
            email: fromEmail,
            name: "KookCast"
          },
          subject: `${conditionEmoji} Go surf at ${surfReport.prime_time} at ${formattedLocation}`,
          templateId: templateId,
          dynamicTemplateData: templateData
        });

        console.log(`[REGULAR_SUCCESS] Sent report to ${user.email} for spot ${formattedLocation}`);
        successCount++;
      } catch (error) {
        console.error(`[USER_ERROR] Failed to process user ${user.email}:`, error);
        errorCount++;
      }
    }

    // Update lock with completion status
    await lockRef.update({
      status: 'completed',
      successCount,
      errorCount,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('[SCHEDULED_REPORTS_COMPLETE]', {
      total_users: usersSnapshot.size,
      success_count: successCount,
      error_count: errorCount,
      timestamp: new Date().toISOString()
    });

    return { success: true, message: 'Surf reports sent successfully' };
  } catch (error) {
    console.error('[SCHEDULED_REPORTS_ERROR]', error);
    // Update lock with error status
    try {
      await admin.firestore().collection('locks').doc('regularReports').update({
        status: 'error',
        error: error.message,
        errorAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (lockError) {
      console.error('[SCHEDULED_REPORTS] Error updating lock:', lockError);
    }
    return { success: false, error: error.message };
  }
});

// Scheduled function to sync email verification status
exports.syncEmailVerification = onSchedule({
  schedule: 'every 1 hours', // Run every hour
  timeZone: 'America/Los_Angeles',
  retryCount: 3,
  memory: '256MiB'
}, async (event) => {
  try {
    console.log('[SYNC_EMAIL_VERIFICATION] Starting email verification sync');
    
    // Get all users from Firestore
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .get();
    
    console.log(`[SYNC_EMAIL_VERIFICATION] Found ${usersSnapshot.size} users to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        
        // Get user's auth record
        const userAuth = await admin.auth().getUser(userDoc.id);
        
        // Check if Firestore needs to be updated
        if (userData.emailVerified !== userAuth.emailVerified) {
          console.log(`[SYNC_EMAIL_VERIFICATION] Updating user ${userDoc.id} - Auth: ${userAuth.emailVerified}, Firestore: ${userData.emailVerified}`);
          
          await admin.firestore()
            .doc(`users/${userDoc.id}`)
            .update({
              emailVerified: userAuth.emailVerified,
              emailVerifiedAt: userAuth.emailVerified ? new Date().toISOString() : null,
              lastSyncAt: new Date().toISOString()
            });
          
          updatedCount++;
        } else {
          // Even if no update needed, update lastSyncAt
          await admin.firestore()
            .doc(`users/${userDoc.id}`)
            .update({
              lastSyncAt: new Date().toISOString()
            });
          
          skippedCount++;
        }
      } catch (error) {
        console.error(`[SYNC_EMAIL_VERIFICATION] Error processing user ${userDoc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('[SYNC_EMAIL_VERIFICATION] Sync complete', {
      total_users: usersSnapshot.size,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
      timestamp: new Date().toISOString()
    });
    
    return { 
      success: true, 
      message: 'Email verification sync completed',
      stats: {
        total_users: usersSnapshot.size,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount
      }
    };
  } catch (error) {
    console.error('[SYNC_EMAIL_VERIFICATION] Error during sync:', error);
    throw error;
  }
});

// Endpoint to sync email verification status immediately after signup
app.post('/sync-email-verification', async (req, res) => {
  try {
    const { uid } = req.body;
    
    if (!uid) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`[SYNC_EMAIL_VERIFICATION] Starting immediate sync for user ${uid}`);
    
    // Get user's auth record
    const userAuth = await admin.auth().getUser(uid);
    
    // Get user's Firestore document
    const userDoc = await admin.firestore().doc(`users/${uid}`).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found in Firestore' });
    }
    
    const userData = userDoc.data();
    
    // Check if Firestore needs to be updated
    if (userData.emailVerified !== userAuth.emailVerified) {
      console.log(`[SYNC_EMAIL_VERIFICATION] Updating user ${uid} - Auth: ${userAuth.emailVerified}, Firestore: ${userData.emailVerified}`);
      
      await admin.firestore()
        .doc(`users/${uid}`)
        .update({
          emailVerified: userAuth.emailVerified,
          emailVerifiedAt: userAuth.emailVerified ? new Date().toISOString() : null,
          lastSyncAt: new Date().toISOString()
        });
      
      return res.json({ 
        success: true, 
        message: 'Email verification status updated',
        emailVerified: userAuth.emailVerified
      });
    }
    
    return res.json({ 
      success: true, 
      message: 'Email verification status already in sync',
      emailVerified: userAuth.emailVerified
    });
    
  } catch (error) {
    console.error('[SYNC_EMAIL_VERIFICATION] Error during immediate sync:', error);
    return res.status(500).json({ error: 'Failed to sync email verification status' });
  }
});

// Test function to send emails immediately
exports.testSendEmails = onRequest({
  cors: true,
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridTemplateId, sendgridPremiumTemplateId, openaiApiKey],
  memory: '256MiB',
  timeoutSeconds: 300,
  minInstances: 1,
  maxInstances: 10,
  concurrency: 1
}, async (req, res) => {
  try {
    // Check rate limit
    const ip = req.ip || req.connection.remoteAddress;
    const rateLimit = await RateLimiter.checkRateLimit(ip, null, 'test');
    if (!rateLimit.success) {
      return res.status(429).json({
        status: 'error',
        message: rateLimit.error
      });
    }

    console.log('[TEST_SEND_EMAILS] Starting testSendEmails function');
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
    }

    // Get user data from Firestore
    const userSnapshot = await admin.firestore()
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const userDoc = userSnapshot.docs[0];
    const user = userDoc.data();
    const userId = userDoc.id;

    console.log(`[TEST_SEND_EMAILS] Processing user ${email} (${userId}) with premium status: ${user.premium}`);

    // Get user's surf locations
    const userData = await getUserData(userId);
    const surfLocations = userData.surfLocations || [];

    if (surfLocations.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'User has no surf locations set'
      });
    }

    const sendGridApiKey = sendgridApiKey.value();
    const fromEmail = sendgridFromEmail.value();
    const templateId = sendgridTemplateId.value();
    const premiumTemplateId = sendgridPremiumTemplateId.value();
    const openAiApiKey = openaiApiKey.value();

    sgMail.setApiKey(sendGridApiKey);

    if (user.premium) {
      console.log(`[TEST_SEND_EMAILS] Sending premium email for ${email}`);
      // Premium user flow - get up to 5 spots and find best match
      const locations = surfLocations.slice(0, 5);
      
      // Process all locations in parallel
      console.log(`[TEST_SEND_EMAILS] Processing ${locations.length} locations in parallel for ${email}`);
      const startTime = Date.now();
      
      const spotReports = await Promise.all(
        locations.map(async (location) => {
          if (!location) return null;
          console.log(`[TEST_SEND_EMAILS] Processing location: ${location}`);
          const report = await generateSurfReport(
            location, 
            userData.surferType, 
            userId, 
            openAiApiKey, 
            userData
          );
          console.log(`[TEST_SEND_EMAILS] Completed location: ${location}`);
          return report;
        })
      );

      const endTime = Date.now();
      console.log(`[TEST_SEND_EMAILS] Parallel processing took ${endTime - startTime}ms`);

      // Filter out any null results
      const validReports = spotReports.filter(report => report !== null);
      console.log(`[TEST_SEND_EMAILS] Generated ${validReports.length} valid reports`);

      // Find the best spot based on skill match percentage
      const bestSpot = validReports.reduce((best, current) => {
        const currentMatch = parseInt(current.skill_match.replace('%', ''));
        const bestMatch = parseInt(best.skill_match.replace('%', ''));
        return currentMatch > bestMatch ? current : best;
      }, validReports[0]);

      // Format the featured spot
      const featuredSpot = {
        name: bestSpot.spot_name,
        highlight: bestSpot.match_summary,
        reason: bestSpot.match_conditions,
        wave: bestSpot.wave_height,
        conditions: bestSpot.conditions,
        skill: bestSpot.skill_match,
        board: bestSpot.best_board,
        air: bestSpot.air_temp,
        cloud: bestSpot.clouds,
        rain: bestSpot.rain_chance,
        wind: bestSpot.wind_description,
        water: bestSpot.water_temp,
        wetsuit: bestSpot.gear,
        best_time: bestSpot.prime_time,
        alt_time: bestSpot.backup_time,
        tip1: bestSpot.tip1,
        tip2: bestSpot.tip2,
        tip3: bestSpot.tip3
      };

      // Format remaining spots
      const otherSpots = validReports
        .filter(spot => spot.spot_name !== bestSpot.spot_name)
        .map(spot => ({
          name: spot.spot_name,
          highlight: spot.match_summary,
          wave: spot.wave_height,
          conditions: spot.conditions,
          skill: spot.skill_match,
          board: spot.best_board,
          best_time: spot.prime_time,
          alt_time: spot.backup_time,
          tide: spot.weatherData?.current?.buoyData?.tide || 'No tide data available'
        }));

      // Prepare template data
      const templateData = {
        user_name: user.displayName || 'Surfer',
        featured_spot: featuredSpot,
        spots: otherSpots,
        total_spots: validReports.length,
        diary_url: "https://kook-cast.com/diary/new-session",
        subject: `${featuredSpot.name} is looking 🔥 today!`
      };

      // Send ONE premium email
      console.log(`[TEST_SEND_EMAILS] Sending single email to ${email} with ${validReports.length} locations`);
      await sgMail.send({
        to: email,
        from: {
          email: fromEmail,
          name: "KookCast"
        },
        subject: `${featuredSpot.name} is looking 🔥 today!`,
        templateId: premiumTemplateId,
        dynamicTemplateData: templateData
      });

      console.log(`[TEST_SEND_EMAILS_SUCCESS] Sent premium email to ${email} with ${validReports.length} spots`);
      
      return res.json({
        status: 'success',
        message: 'Test email sent successfully',
        details: {
          locations_processed: locations.length,
          valid_reports: validReports.length,
          processing_time_ms: endTime - startTime
        }
      });
    } else {
      // Regular user flow - only send email for their selected spot
      console.log(`[TEST_SEND_EMAILS] Sending regular email for ${email}`);
      const location = surfLocations[0];
      if (!location) {
        return res.status(400).json({
          status: 'error',
          message: 'No surf location found'
        });
      }

      const surfReport = await generateSurfReport(
        location, 
        userData.surferType, 
        userId, 
        openAiApiKey, 
        userData
      );

      const formattedLocation = formatLocation(surfReport.location);
      const subject = `Go surf at ${surfReport.prime_time} at ${formattedLocation}`;

      // Determine condition emoji based on skill match percentage
      const skillMatch = parseInt(surfReport.skill_match.replace('%', ''));
      const conditionEmoji = skillMatch >= 75 ? '🟢' : 
                           skillMatch >= 50 ? '🟡' : '🔴';

      // Format template data
      const templateData = {
        spot_name: formattedLocation,
        match_summary: surfReport.match_summary,
        match_conditions: surfReport.match_conditions,
        wave_height: surfReport.wave_height,
        conditions: surfReport.conditions,
        skill_match: surfReport.skill_match,
        best_board: surfReport.best_board,
        air_temp: surfReport.air_temp,
        clouds: surfReport.clouds,
        rain_chance: surfReport.rain_chance,
        wind_description: surfReport.wind_description,
        water_temp: surfReport.water_temp,
        gear: surfReport.gear,
        prime_time: surfReport.prime_time,
        prime_notes: surfReport.prime_notes,
        backup_time: surfReport.backup_time,
        backup_notes: surfReport.backup_notes,
        tip1: surfReport.tip1,
        tip2: surfReport.tip2,
        tip3: surfReport.tip3,
        daily_challenge: surfReport.daily_challenge,
        skill_focus: surfReport.skill_focus,
        diary_url: "https://kook-cast.com/diary/new-session",
        subject: `${conditionEmoji} Go surf at ${surfReport.prime_time} at ${formattedLocation}`
      };

      // Send ONE regular email
      console.log(`[TEST_SEND_EMAILS] Sending single email to ${email} for spot ${formattedLocation}`);
      await sgMail.send({
        to: email,
        from: {
          email: fromEmail,
          name: "KookCast"
        },
        subject: `${conditionEmoji} Go surf at ${surfReport.prime_time} at ${formattedLocation}`,
        templateId: templateId,
        dynamicTemplateData: templateData
      });

      console.log(`[TEST_SEND_EMAILS_SUCCESS] Sent regular email to ${email} for spot ${formattedLocation}`);
      
      return res.json({
        status: 'success',
        message: 'Test email sent successfully',
        details: {
          location: formattedLocation,
          skill_match: surfReport.skill_match
        }
      });
    }
  } catch (error) {
    console.error('[TEST_SEND_EMAILS] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send test email',
      error: error.message
    });
  }
});

// Premium email function
exports.sendPremiumSurfReports = onSchedule({
  schedule: '0 3 * * *',  // 3 AM Iowa time = 5 AM LA time
  timeZone: 'America/Chicago',  // Iowa timezone
  retryCount: 0,
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridPremiumTemplateId, openaiApiKey],
  memory: '256MiB'
}, async (event) => {
  try {
    // Get today's date in LA timezone
    const laDate = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const today = new Date(laDate);
    const dateKey = today.toISOString().split('T')[0];

    // Check for existing lock using a transaction
    const lockRef = admin.firestore().collection('locks').doc('premiumReports');
    
    const result = await admin.firestore().runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      const lockData = lockDoc.data();
      
      // If lock exists and is from today, skip
      if (lockData?.date === dateKey) {
        console.log('[PREMIUM_REPORTS] Skipping - already processed today');
        return { shouldRun: false };
      }
      
      // Set new lock with today's date
      transaction.set(lockRef, {
        date: dateKey,
        state: 'running',
        lastRun: admin.firestore.FieldValue.serverTimestamp(),
        instanceId: Math.random().toString(36).substring(7)
      });
      
      return { shouldRun: true };
    });

    if (!result.shouldRun) {
      return;
    }

    console.log('[PREMIUM_REPORTS] Starting premium surf report distribution');
    
    // Get all premium users with emailVerified = true
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('emailVerified', '==', true)
      .where('premium', '==', true)
      .get();
    
    console.log(`[PREMIUM_REPORTS] Found ${usersSnapshot.size} premium users`);

    const sendGridApiKey = sendgridApiKey.value();
    const fromEmail = sendgridFromEmail.value();
    const premiumTemplateId = sendgridPremiumTemplateId.value();
    const openAiApiKey = openaiApiKey.value();

    sgMail.setApiKey(sendGridApiKey);

    // Process each premium user
    let successCount = 0;
    let errorCount = 0;
    const processedUsers = new Set();
    
    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data() || {};
      const userId = userDoc.id;
      
      // Skip if already processed
      if (processedUsers.has(userId)) {
        console.log(`[PREMIUM_REPORTS] Skipping already processed user ${userId}`);
        continue;
      }
      processedUsers.add(userId);
      
      try {
        // Get user data with defaults
        const userData = await getUserData(userId);
        
        // Skip if no surf locations
        if (!userData.surfLocations || userData.surfLocations.length === 0) {
          console.log(`[SKIP_PREMIUM_USER] User ${user.email} has no surf locations set`);
          continue;
        }

        // Get up to 5 surf locations
        const locations = userData.surfLocations.slice(0, 5);
        
        // Process all locations in parallel
        console.log(`[PROCESSING_PREMIUM_USER] Generating reports for ${user.email} - ${locations.length} locations`);
        const startTime = Date.now();
        
        const spotReports = await Promise.all(
          locations.map(async (location) => {
            if (!location) return null;
            console.log(`[PROCESSING_LOCATION] ${user.email} - ${location}`);
            return generateSurfReport(
              location, 
              userData.surferType, 
              userId, 
              openAiApiKey, 
              userData
            );
          })
        );

        const endTime = Date.now();
        console.log(`[PROCESSING_TIME] Took ${endTime - startTime}ms to process ${locations.length} locations`);

        // Filter out any null results
        const validReports = spotReports.filter(report => report !== null);
        console.log(`[VALID_REPORTS] Generated ${validReports.length} valid reports`);

        // Find the best spot based on skill match percentage
        const bestSpot = validReports.reduce((best, current) => {
          const currentMatch = parseInt(current.skill_match.replace('%', ''));
          const bestMatch = parseInt(best.skill_match.replace('%', ''));
          return currentMatch > bestMatch ? current : best;
        }, validReports[0]);

        // Format the featured spot
        const featuredSpot = {
          name: bestSpot.spot_name,
          highlight: bestSpot.match_summary,
          reason: bestSpot.match_conditions,
          wave: bestSpot.wave_height,
          conditions: bestSpot.conditions,
          skill: bestSpot.skill_match,
          board: bestSpot.best_board,
          air: bestSpot.air_temp,
          cloud: bestSpot.clouds,
          rain: bestSpot.rain_chance,
          wind: bestSpot.wind_description,
          water: bestSpot.water_temp,
          wetsuit: bestSpot.gear,
          best_time: bestSpot.prime_time,
          alt_time: bestSpot.backup_time,
          tip1: bestSpot.tip1,
          tip2: bestSpot.tip2,
          tip3: bestSpot.tip3,
          tide: bestSpot.weatherData?.current?.buoyData?.tide || 'No tide data available'
        };

        // Format remaining spots
        const otherSpots = validReports
          .filter(spot => spot.spot_name !== bestSpot.spot_name)
          .map(spot => ({
            name: spot.spot_name,
            highlight: spot.match_summary,
            wave: spot.wave_height,
            conditions: spot.conditions,
            skill: spot.skill_match,
            board: spot.best_board,
            best_time: spot.prime_time,
            alt_time: spot.backup_time,
            tide: spot.weatherData?.current?.buoyData?.tide || 'No tide data available'
          }));

        // Prepare template data
        const templateData = {
          user_name: user.displayName || 'Surfer',
          featured_spot: featuredSpot,
          spots: otherSpots,
          total_spots: validReports.length,
          diary_url: "https://kook-cast.com/diary/new-session",
          subject: `${featuredSpot.name} is looking 🔥 today!`
        };

        // Send ONE premium email
        console.log(`[SENDING_EMAIL] Sending single email to ${user.email} with ${validReports.length} locations`);
        const emailResult = await sgMail.send({
          to: user.email,
          from: {
            email: fromEmail,
            name: "KookCast"
          },
          subject: `${featuredSpot.name} is looking 🔥 today!`,
          templateId: premiumTemplateId,
          dynamicTemplateData: templateData
        });

        // Verify email was sent successfully
        if (!emailResult || !emailResult[0]?.statusCode === 202) {
          throw new Error('Failed to send email');
        }

        console.log(`[EMAIL_SENT] Successfully sent email to ${user.email}`);
        successCount++;
      } catch (error) {
        console.error(`[USER_ERROR] Failed to process user ${user.email}:`, error);
        errorCount++;
        
        // Update user's status in Firestore
        try {
          await admin.firestore()
            .collection('users')
            .doc(userId)
            .update({
              lastEmailError: error.message,
              lastEmailAttempt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (updateError) {
          console.error(`[UPDATE_ERROR] Failed to update user status for ${user.email}:`, updateError);
        }
      }
    }

    // Update lock with completion status
    await lockRef.update({
      state: 'completed',
      successCount,
      errorCount,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('[PREMIUM_REPORTS_COMPLETE]', {
      total_users: usersSnapshot.size,
      success_count: successCount,
      error_count: errorCount,
      timestamp: new Date().toISOString()
    });

    return { success: true, message: 'Premium surf reports sent successfully' };
  } catch (error) {
    console.error('[PREMIUM_REPORTS_ERROR]', error);
    // Update lock with error status
    try {
      await admin.firestore().collection('locks').doc('premiumReports').update({
        state: 'failed',
        error: error.message,
        errorAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (lockError) {
      console.error('[PREMIUM_REPORTS] Error updating lock:', lockError);
    }
    return { success: false, error: error.message };
  }
});

// Migration function to standardize surf locations field name
exports.migrateSurfLocations = functions.https.onRequest(async (req, res) => {
  try {
    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').get();
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        
        // Skip if user already has surfLocations
        if (userData.surfLocations) {
          continue;
        }
        
        // If user has selectedSpots, migrate to surfLocations
        if (userData.selectedSpots) {
          await userDoc.ref.update({
            surfLocations: userData.selectedSpots,
            updatedAt: new Date().toISOString()
          });
          migratedCount++;
        }
      } catch (error) {
        console.error(`Error migrating user ${userDoc.id}:`, error);
        errorCount++;
      }
    }
    
    res.json({
      success: true,
      migratedCount,
      errorCount,
      message: `Migration complete. Migrated ${migratedCount} users, ${errorCount} errors.`
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Sync premium status when subscription changes
exports.syncPremiumStatus = functions.firestore
  .onDocumentWritten('customers/{userId}/subscriptions/{subscriptionId}', async (event) => {
    const { userId } = event.params;
    const subscription = event.data?.after?.data();

    if (!subscription) return;

    const isActive = subscription.status === 'active' && subscription.cancel_at_period_end === false;

    const userRef = admin.firestore().collection('users').doc(userId);

    await userRef.update({
      premium: isActive,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`User ${userId} premium status set to`, isActive);
  });

// Start the server if we're not in Firebase Functions
if (process.env.NODE_ENV === 'development') {
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

// Add rate limiting middleware to Express app
app.use(async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const userId = req.body.userId || null;
    const endpoint = req.path.split('/').pop() || 'default';
    
    const rateLimit = await RateLimiter.checkRateLimit(ip, userId, endpoint);
    if (!rateLimit.success) {
      return res.status(429).json({
        status: 'error',
        message: rateLimit.error
      });
    }
    next();
  } catch (error) {
    console.error('[RATE_LIMIT_ERROR]', error);
    next();
  }
});

// Update API function with rate limiting
exports.api = onRequest({
  cors: true,
  maxInstances: 10,
  memory: "256MiB",
  timeoutSeconds: 60,
  minInstances: 0,
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridTemplateId, openaiApiKey],
  invoker: "public",
  concurrency: 1
}, app);

// Export the functions
module.exports = {
  ...module.exports,
  generateSurfReport,
  formatLocation
};

// Function to fix lock state
async function fixLockState() {
  const lockRef = admin.firestore().collection('locks').doc('premiumReports');
  const laDate = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const today = new Date(laDate);
  const dateKey = today.toISOString().split('T')[0];
  
  await lockRef.set({
    date: dateKey,
    state: 'completed',
    lastRun: admin.firestore.FieldValue.serverTimestamp(),
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    fixed: true
  });
  
  console.log('[LOCK_FIXED] Lock state updated to completed');
}

// Test endpoint to fix lock state
app.post('/fix-lock', async (req, res) => {
  try {
    await fixLockState();
    res.json({
      status: 'success',
      message: 'Lock state fixed'
    });
  } catch (error) {
    console.error('[FIX_LOCK_ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fix lock state',
      error: error.message
    });
  }
});
