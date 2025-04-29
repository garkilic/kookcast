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
const worldTidesApiKey = defineSecret('WORLDTIDES_API_KEY');

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

        // Score each spot based on multiple factors
        const scoredSpots = validReports.map(spot => {
          // Get skill match percentage
          const skillMatch = parseInt(spot.skill_match.replace('%', ''));
          
          // Get tide data
          const tideData = spot.weatherData?.current?.buoyData;
          const tideScore = tideData ? {
            current: tideData.tide,
            trend: tideData.tideTrend,
            nextHigh: tideData.nextHighTide,
            nextLow: tideData.nextLowTide,
            range: tideData.tideRange
          } : null;
          
          // Get wave data
          const waveData = spot.weatherData?.current;
          const waveScore = waveData ? {
            height: waveData.waveHeight,
            period: waveData.swellPeriod,
            direction: waveData.swellDirection
          } : null;
          
          // Get wind data
          const windData = spot.weatherData?.current;
          const windScore = windData ? {
            speed: windData.windSpeed,
            direction: windData.windDirection,
            gusts: windData.windGusts
          } : null;
          
          // Calculate overall score
          let overallScore = skillMatch; // Base score on skill match
          
          // Add tide score if available
          if (tideScore) {
            if (tideScore.trend === 'rising') overallScore += 10;
            if (tideScore.range && tideScore.range.range > 2 && tideScore.range.range < 6) overallScore += 5;
          }
          
          // Add wave score if available
          if (waveScore) {
            if (waveScore.height > 2 && waveScore.height < 6) overallScore += 10;
            if (waveScore.period > 8) overallScore += 5;
          }
          
          // Add wind score if available
          if (windScore) {
            if (windScore.speed < 10) overallScore += 10;
            if (windScore.direction > 180 && windScore.direction < 360) overallScore += 5;
          }
          
          return {
            ...spot,
            score: overallScore,
            tideData,
            waveData,
            windData
          };
        });

        // Sort spots by score and take top 3
        const bestSpots = scoredSpots
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        console.log(`[BEST_SPOTS] Selected top 3 spots for ${user.email}:`, 
          bestSpots.map(spot => `${spot.spot_name} (Score: ${spot.score})`));

        // Format the featured spot (best overall)
        const featuredSpot = {
          name: bestSpots[0].spot_name,
          highlight: bestSpots[0].match_summary,
          reason: bestSpots[0].match_conditions,
          wave: bestSpots[0].wave_height,
          conditions: bestSpots[0].conditions,
          skill: bestSpots[0].skill_match,
          board: bestSpots[0].best_board,
          air: bestSpots[0].air_temp,
          cloud: bestSpots[0].clouds,
          rain: bestSpots[0].rain_chance,
          wind: bestSpots[0].wind_description,
          water: bestSpots[0].water_temp,
          wetsuit: bestSpots[0].gear,
          best_time: bestSpots[0].prime_time,
          alt_time: bestSpots[0].backup_time,
          tide: bestSpots[0].tideData ? {
            current: `${bestSpots[0].tideData.tide}ft`,
            trend: bestSpots[0].tideData.tideTrend,
            nextHigh: bestSpots[0].tideData.nextHighTide ? {
              time: bestSpots[0].tideData.nextHighTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              height: `${bestSpots[0].tideData.nextHighTide.height}ft`
            } : null,
            nextLow: bestSpots[0].tideData.nextLowTide ? {
              time: bestSpots[0].tideData.nextLowTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              height: `${bestSpots[0].tideData.nextLowTide.height}ft`
            } : null,
            range: bestSpots[0].tideData.tideRange ? {
              min: `${bestSpots[0].tideData.tideRange.min}ft`,
              max: `${bestSpots[0].tideData.tideRange.max}ft`,
              range: `${bestSpots[0].tideData.tideRange.range}ft`
            } : null
          } : 'No tide data available',
          swell: bestSpots[0].swell_data
        };

        // Format additional spots (2nd and 3rd best)
        const additionalSpots = bestSpots.slice(1).map(spot => {
          const tideData = spot.tideData;
          console.log(`[TIDE_DATA] Spot ${spot.spot_name}: ${tideData ? `Tide: ${tideData.tide}ft (${tideData.tideTrend})` : 'No tide data available'}`);
          return {
            name: spot.spot_name,
            highlight: spot.match_summary,
            reason: spot.match_conditions,
            wave: spot.wave_height,
            conditions: spot.conditions,
            skill: spot.skill_match,
            board: spot.best_board,
            air: spot.air_temp,
            cloud: spot.clouds,
            rain: spot.rain_chance,
            wind: spot.wind_description,
            water: spot.water_temp,
            wetsuit: spot.gear,
            best_time: spot.prime_time,
            alt_time: spot.backup_time,
            tide: tideData ? {
              current: `${tideData.tide}ft`,
              trend: tideData.tideTrend,
              nextHigh: tideData.nextHighTide ? {
                time: tideData.nextHighTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                height: `${tideData.nextHighTide.height}ft`
              } : null,
              nextLow: tideData.nextLowTide ? {
                time: tideData.nextLowTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                height: `${tideData.nextLowTide.height}ft`
              } : null,
              range: tideData.tideRange ? {
                min: `${tideData.tideRange.min}ft`,
                max: `${tideData.tideRange.max}ft`,
                range: `${tideData.tideRange.range}ft`
              } : null
            } : 'No tide data available',
            swell: spot.swell_data
          };
        });

        // Prepare email template data
        const templateData = {
          featured_spot: {
            name: featuredSpot.spot_name,
            highlight: featuredSpot.match_summary,
            reason: featuredSpot.match_conditions,
            wave: featuredSpot.wave_height,
            conditions: featuredSpot.conditions,
            skill: featuredSpot.skill_match,
            board: featuredSpot.best_board,
            air: featuredSpot.air_temp,
            cloud: featuredSpot.clouds,
            rain: featuredSpot.rain_chance,
            wind: featuredSpot.wind_description,
            water: featuredSpot.water_temp,
            wetsuit: featuredSpot.gear,
            best_time: featuredSpot.prime_time,
            alt_time: featuredSpot.backup_time,
            tip1: featuredSpot.tip1,
            tip2: featuredSpot.tip2,
            tip3: featuredSpot.tip3,
            daily_challenge: featuredSpot.daily_challenge,
            skill_focus: featuredSpot.skill_focus
          },
          additional_spots: additionalSpots,
          user_name: userData.name || 'Surfer',
          date: today.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'America/Los_Angeles'
          }),
          diary_url: "https://kook-cast.com/diary/new-session",
          subject: `${conditionEmoji} Go surf at ${featuredSpot.prime_time} at ${featuredSpot.spot_name}`
        };

        // Send ONE premium email
        console.log(`[SENDING_EMAIL] Sending single email to ${user.email} with ${validReports.length} locations`);
        const emailResult = await sgMail.send({
          to: user.email,
          from: {
            email: fromEmail,
            name: "KookCast"
          },
          subject: `${conditionEmoji} Go surf at ${featuredSpot.prime_time} at ${featuredSpot.spot_name}`,
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

    // Ensure we have valid data for current hour
    const currentHour = currentHourIndex || 0;
    
    // Get wave data from marine data if buoy data is missing
    const waveHeight = buoyData?.waveHeight || convertToFeet(marineData?.hourly?.wave_height?.[currentHour]);
    const swellPeriod = buoyData?.swellPeriod || marineData?.hourly?.swell_wave_period?.[currentHour];
    const waterTemp = buoyData?.waterTemperature || convertToFahrenheit(marineData?.hourly?.water_temperature?.[currentHour]);

    return {
      current: {
        waveHeight,
        swellHeight: convertToFeet(marineData?.hourly?.swell_wave_height?.[currentHour]),
        windWaveHeight: convertToFeet(marineData?.hourly?.wind_wave_height?.[currentHour]),
        swellDirection: marineData?.hourly?.swell_wave_direction?.[currentHour],
        windWaveDirection: marineData?.hourly?.wind_wave_direction?.[currentHour],
        swellPeriod,
        swellPeakPeriod: marineData?.hourly?.swell_wave_peak_period?.[currentHour],
        temperature: convertToFahrenheit(weatherData?.hourly?.temperature_2m?.[currentHour]),
        windSpeed: convertToMph(weatherData?.hourly?.windspeed_10m?.[currentHour]),
        windDirection: weatherData?.hourly?.winddirection_10m?.[currentHour],
        windGusts: convertToMph(weatherData?.hourly?.windgusts_10m?.[currentHour]),
        buoyData: buoyData ? {
          waterTemperature: waterTemp,
          waveHeight,
          wavePeriod: swellPeriod,
          tide: buoyData.tide || null,
          tideTrend: buoyData.tideTrend || null,
          nextHighTide: buoyData.nextHighTide || null,
          nextLowTide: buoyData.nextLowTide || null,
          tideRange: buoyData.tideRange || null
        } : null
      },
      today: {
        maxWaveHeight: convertToFeet(marineData?.daily?.wave_height_max?.[0]),
        maxSwellHeight: convertToFeet(marineData?.daily?.swell_wave_height_max?.[0]),
        maxWindWaveHeight: convertToFeet(marineData?.daily?.wind_wave_height_max?.[0]),
        maxTemp: convertToFahrenheit(weatherData?.daily?.temperature_2m_max?.[0]),
        minTemp: convertToFahrenheit(weatherData?.daily?.temperature_2m_min?.[0]),
        maxWindSpeed: convertToMph(weatherData?.daily?.windspeed_10m_max?.[0])
      }
    };
  }
};

// Buoy Data Module
const BuoyData = {
  // Known buoy stations for Southern California
  knownStations: [
    // Malibu Area
    { id: '46232', name: 'Santa Monica Basin', lat: 33.738, lon: -118.418 },
    { id: '46225', name: 'Santa Monica Bay', lat: 33.738, lon: -118.418 },
    { id: '46224', name: 'Malibu', lat: 34.037, lon: -118.678 },
    { id: '46223', name: 'Point Dume', lat: 34.002, lon: -118.805 },
    
    // South Bay Area
    { id: '46222', name: 'San Pedro South', lat: 33.618, lon: -118.288 },
    { id: '46221', name: 'San Pedro Bay', lat: 33.618, lon: -118.288 },
    { id: '46220', name: 'Palos Verdes', lat: 33.742, lon: -118.410 },
    { id: '46219', name: 'Redondo Beach', lat: 33.842, lon: -118.410 },
    { id: '46218', name: 'Long Beach', lat: 33.618, lon: -118.288 },
    { id: '46217', name: 'Los Angeles Harbor', lat: 33.718, lon: -118.268 },
    
    // LA Harbor Area
    { id: '46216', name: 'Los Angeles Harbor Entrance', lat: 33.718, lon: -118.268 },
    { id: '46215', name: 'Los Angeles Harbor Channel', lat: 33.718, lon: -118.268 },
    { id: '46214', name: 'Los Angeles Harbor Breakwater', lat: 33.718, lon: -118.268 },
    { id: '46213', name: 'Los Angeles Harbor Inner', lat: 33.718, lon: -118.268 },
    { id: '46212', name: 'Los Angeles Harbor Outer', lat: 33.718, lon: -118.268 },
    
    // Ventura Area
    { id: '46211', name: 'Ventura Harbor', lat: 34.247, lon: -119.258 },
    { id: '46210', name: 'Ventura Point', lat: 34.275, lon: -119.295 },
    { id: '46209', name: 'Ventura County', lat: 34.247, lon: -119.258 },
    
    // Orange County
    { id: '46208', name: 'Huntington Beach', lat: 33.655, lon: -118.002 },
    { id: '46207', name: 'Newport Beach', lat: 33.618, lon: -117.928 },
    { id: '46206', name: 'Laguna Beach', lat: 33.542, lon: -117.783 },
    { id: '46205', name: 'Dana Point', lat: 33.467, lon: -117.702 },
    
    // San Diego Area
    { id: '46204', name: 'San Diego Bay', lat: 32.715, lon: -117.173 },
    { id: '46203', name: 'Mission Bay', lat: 32.783, lon: -117.217 },
    { id: '46202', name: 'La Jolla', lat: 32.832, lon: -117.271 },
    { id: '46201', name: 'Del Mar', lat: 32.967, lon: -117.267 }
  ],

  // Find closest station to given coordinates
  findClosestStation(lat, lon) {
    let closestStation = null;
    let minDistance = Infinity;
    
    for (const station of this.knownStations) {
      const distance = this.calculateDistance(lat, lon, station.lat, station.lon);
      if (distance < minDistance) {
        minDistance = distance;
        closestStation = station;
      }
    }
    
    return closestStation;
  },

  // Calculate distance between two points using Haversine formula
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  toRad(degrees) {
    return degrees * (Math.PI/180);
  },

  // Tide data enhancement
  async fetchStationData(stationId, spotLat, spotLon) {
    try {
      console.log(`[TIDE_DATA] Fetching data for station ${stationId} at spot coordinates ${spotLat},${spotLon}`);
      
      // Try NOAA NDBC first
      const ndbcResponse = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${stationId}.txt`);
      const dataText = await ndbcResponse.text();
      const basicData = this.parseStationData(dataText);
      
      // If no NDBC data, try WorldTides using spot coordinates
      try {
        const worldTidesKey = worldTidesApiKey.value();
        const worldTidesResponse = await fetch(`https://www.worldtides.info/api/v2?heights&lat=${spotLat}&lon=${spotLon}&key=${worldTidesKey}`);
        const worldTidesData = await worldTidesResponse.json();
        
        if (worldTidesData?.heights?.[0]) {
          basicData.tide = worldTidesData.heights[0].height;
          console.log(`[TIDE_DATA] Retrieved tide data from WorldTides for spot: ${basicData.tide}ft`);
          return await this.enhanceTideData(basicData, spotLat, spotLon);
        }
      } catch (worldTidesError) {
        console.error('[TIDE_DATA] Error fetching WorldTides data:', worldTidesError);
      }
      
      // If WorldTides fails, try NOAA predictions
      try {
        const tideResponse = await fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${stationId}&product=predictions&datum=MLLW&time_zone=lst_ldt&units=english&format=json`);
        const tideData = await tideResponse.json();
        
        if (tideData?.predictions?.[0]) {
          basicData.tide = parseFloat(tideData.predictions[0].v);
          console.log(`[TIDE_DATA] Retrieved tide data from NOAA predictions: ${basicData.tide}ft`);
          return await this.enhanceTideData(basicData, spotLat, spotLon);
        }
      } catch (tideError) {
        console.error('[TIDE_DATA] Error fetching tide predictions:', tideError);
      }
      
      // If all sources fail, return basic data without tide
      console.warn(`[TIDE_DATA] No tide data available for station ${stationId}`);
      return basicData;
      
    } catch (error) {
      console.error('[TIDE_DATA] Error fetching station data:', error);
      return null;
    }
  },

  async enhanceTideData(stationData, spotLat, spotLon) {
    if (!stationData) return null;
    
    try {
      // Get historical tide data from WorldTides using spot coordinates
      const worldTidesKey = worldTidesApiKey.value();
      const worldTidesResponse = await fetch(`https://www.worldtides.info/api/v2?heights&lat=${spotLat}&lon=${spotLon}&key=${worldTidesKey}&step=3600&length=86400`);
      const worldTidesData = await worldTidesResponse.json();
      
      if (worldTidesData?.heights) {
        // Calculate tide trends
        const tideTrend = this.calculateTideTrend(worldTidesData.heights);
        
        // Find next high and low tides
        const nextHighTide = this.findNextHighTide(worldTidesData.heights);
        const nextLowTide = this.findNextLowTide(worldTidesData.heights);
        
        // Calculate tide range
        const tideRange = this.calculateTideRange(worldTidesData.heights);
        
        return {
          ...stationData,
          tideTrend,
          nextHighTide,
          nextLowTide,
          tideRange
        };
      }
      
      return stationData;
    } catch (error) {
      console.error('[TIDE_DATA] Error enhancing tide data:', error);
      return stationData;
    }
  },

  calculateTideTrend(heights) {
    if (!heights || heights.length < 2) return 'unknown';
    
    const recentHeights = heights.slice(-6); // Last 6 readings
    const firstHeight = recentHeights[0].height;
    const lastHeight = recentHeights[recentHeights.length - 1].height;
    
    const difference = lastHeight - firstHeight;
    if (Math.abs(difference) < 0.1) return 'stable';
    return difference > 0 ? 'rising' : 'falling';
  },

  findNextHighTide(heights) {
    if (!heights || heights.length < 12) return null;
    
    const currentTime = new Date().getTime();
    const futureHeights = heights.filter(h => new Date(h.dt * 1000) > currentTime);
    
    if (futureHeights.length === 0) return null;
    
    let maxHeight = futureHeights[0];
    for (const height of futureHeights) {
      if (height.height > maxHeight.height) {
        maxHeight = height;
      }
    }
    
    return {
      time: new Date(maxHeight.dt * 1000),
      height: maxHeight.height
    };
  },

  findNextLowTide(heights) {
    if (!heights || heights.length < 12) return null;
    
    const currentTime = new Date().getTime();
    const futureHeights = heights.filter(h => new Date(h.dt * 1000) > currentTime);
    
    if (futureHeights.length === 0) return null;
    
    let minHeight = futureHeights[0];
    for (const height of futureHeights) {
      if (height.height < minHeight.height) {
        minHeight = height;
      }
    }
    
    return {
      time: new Date(minHeight.dt * 1000),
      height: minHeight.height
    };
  },

  calculateTideRange(heights) {
    if (!heights || heights.length < 12) return null;
    
    const maxHeight = Math.max(...heights.map(h => h.height));
    const minHeight = Math.min(...heights.map(h => h.height));
    
    return {
      max: maxHeight,
      min: minHeight,
      range: maxHeight - minHeight
    };
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
      // Find closest station
      const closestStation = BuoyData.findClosestStation(latitude, longitude);
      if (!closestStation) {
        console.warn('[BUOY_DATA] No nearby station found');
        return null;
      }

      console.log(`[BUOY_DATA] Using station ${closestStation.name} (${closestStation.id}) for coordinates ${latitude},${longitude}`);
      
      // Fetch station data using spot coordinates
      const stationData = await BuoyData.fetchStationData(closestStation.id, latitude, longitude);
      if (!stationData) {
        console.warn('[BUOY_DATA] Failed to fetch station data');
        return null;
      }

      return {
        station: closestStation.name,
        tide: stationData.tide,
        tideTrend: stationData.tideTrend,
        nextHighTide: stationData.nextHighTide,
        nextLowTide: stationData.nextLowTide,
        tideRange: stationData.tideRange
      };
    } catch (error) {
      console.error('[BUOY_DATA] Error fetching buoy data:', error);
      return null;
    }
  },

  async generateAIReport(location, weatherData, apiKey, userData = null) {
    const openai = new OpenAI({ apiKey });
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const formattedLocation = formatLocation(location);
    
    console.log('[AI_REPORT] Generating report for:', {
      location: formattedLocation,
      date: formattedDate,
      hasUserData: !!userData,
      weatherDataKeys: Object.keys(weatherData || {}),
      currentConditions: weatherData?.current ? {
        waveHeight: weatherData.current.waveHeight,
        swellPeriod: weatherData.current.swellPeriod,
        waterTemp: weatherData.current.buoyData?.waterTemperature,
        tide: weatherData.current.buoyData?.tide
      } : null
    });

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
          Skill Level: ${userData?.skillLevel || 'intermediate'}
          Preferred Conditions: ${userData?.preferredConditions?.join(', ') || 'none specified'}
          Goals: ${userData?.goals?.join(', ') || 'none specified'}
          
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
          
          Average wave count: ${userData?.averageWaveCount || 0} waves per session
          
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
          ${userData?.userBoards || 'No boards available'}
          
          For each field, generate dynamic content based on the actual data, writing as if you're personally guiding the surfer:
          - spot_name: The name of the surf spot
          - match_summary: One sentence explaining why these conditions match the surfer's skill level and preferences, referencing their recent sessions or goals
          - match_conditions: One sentence about the overall conditions matching their style, with a personal touch
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
          - prime_notes: Brief note about why this time is good, referencing their recent sessions if relevant
          - backup_time: Format as "X:XX–X:XXam/pm"
          - backup_notes: Brief note about why this time is good
          - tip1: Specific tip based on conditions and skill level, referencing their recent sessions or goals
          - tip2: Specific tip about technique or strategy for these conditions
          - tip3: A fun fact about surfing or the local area
          - daily_challenge: One specific, achievable challenge based on their goals and recent performance
          - skill_focus: One specific skill to focus on based on their recent sessions
          - fun_fact: An interesting fact about surfing, the local area, or surf history
          
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
            "skill_focus": "string",
            "fun_fact": "string"
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
    
    console.log('[AI_REPORT] Generated report:', {
      spot_name: report.spot_name,
      skill_match: report.skill_match,
      wave_height: report.wave_height,
      conditions: report.conditions,
      has_tips: !!(report.tip1 && report.tip2 && report.tip3),
      has_challenge: !!report.daily_challenge,
      has_skill_focus: !!report.skill_focus
    });
    
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

    // Use nested surferPreferences for description and boardTypes
    const surferPreferences = userData.surferPreferences || {};
    const surfingStyle = surferPreferences.description || 'intermediate';
    const boardTypes = Array.isArray(surferPreferences.boardTypes) ? surferPreferences.boardTypes : [];
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

    // Validate required data
    if (!marineData || !weatherData) {
      throw new Error('Failed to fetch required weather data');
    }

    console.log('[TIDE_DEBUG] Buoy data:', JSON.stringify(buoyData, null, 2));
    
    const formattedData = WeatherProcessor.formatWeatherData(
      marineData,
      weatherData,
      buoyData,
      currentHourIndex
    );
    
    console.log('[TIDE_DEBUG] Formatted data:', JSON.stringify(formattedData?.current?.buoyData, null, 2));
    
    // Validate formatted data
    if (!formattedData?.current) {
      throw new Error('Failed to format weather data');
    }

    const report = await SurfReportGenerator.generateAIReport(location, formattedData, apiKey, userData);
    
    // Ensure tide data is properly passed through
    if (buoyData) {
      report.weatherData = {
        ...report.weatherData,
        current: {
          ...report.weatherData?.current,
          buoyData: buoyData
        }
      };
    }
    
    console.log('[TIDE_DEBUG] Report data:', JSON.stringify(report?.weatherData?.current?.buoyData, null, 2));
    
    // Validate report data
    if (!report.spot_name || !report.prime_time || !report.skill_match) {
      throw new Error('Generated report is missing required fields');
    }
    
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
  schedule: '0 5 * * *',  // 5 AM LA time
  timeZone: 'America/Los_Angeles',  // California timezone
  retryCount: 0,
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridTemplateId, sendgridPremiumTemplateId, openaiApiKey, worldTidesApiKey],
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
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridTemplateId, sendgridPremiumTemplateId, openaiApiKey, worldTidesApiKey],
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

      // Score each spot based on multiple factors
      const scoredSpots = validReports.map(spot => {
        // Get skill match percentage
        const skillMatch = parseInt(spot.skill_match.replace('%', ''));
        
        // Get tide data
        const tideData = spot.weatherData?.current?.buoyData;
        const tideScore = tideData ? {
          current: tideData.tide,
          trend: tideData.tideTrend,
          nextHigh: tideData.nextHighTide,
          nextLow: tideData.nextLowTide,
          range: tideData.tideRange
        } : null;
        
        // Get wave data
        const waveData = spot.weatherData?.current;
        const waveScore = waveData ? {
          height: waveData.waveHeight,
          period: waveData.swellPeriod,
          direction: waveData.swellDirection
        } : null;
        
        // Get wind data
        const windData = spot.weatherData?.current;
        const windScore = windData ? {
          speed: windData.windSpeed,
          direction: windData.windDirection,
          gusts: windData.windGusts
        } : null;
        
        // Calculate overall score
        let overallScore = skillMatch; // Base score on skill match
        
        // Add tide score if available
        if (tideScore) {
          if (tideScore.trend === 'rising') overallScore += 10;
          if (tideScore.range && tideScore.range.range > 2 && tideScore.range.range < 6) overallScore += 5;
        }
        
        // Add wave score if available
        if (waveScore) {
          if (waveScore.height > 2 && waveScore.height < 6) overallScore += 10;
          if (waveScore.period > 8) overallScore += 5;
        }
        
        // Add wind score if available
        if (windScore) {
          if (windScore.speed < 10) overallScore += 10;
          if (windScore.direction > 180 && windScore.direction < 360) overallScore += 5;
        }
        
        return {
          ...spot,
          score: overallScore,
          tideData,
          waveData,
          windData
        };
      });

      // Sort spots by score and take top 3
      const bestSpots = scoredSpots
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      console.log(`[TEST_SEND_EMAILS] Selected top 3 spots:`, 
        bestSpots.map(spot => `${spot.spot_name} (Score: ${spot.score})`));

      // Determine condition emoji based on skill match percentage of best spot
      const skillMatch = parseInt(bestSpots[0].skill_match.replace('%', ''));
      const conditionEmoji = skillMatch >= 75 ? '🟢' : 
                           skillMatch >= 50 ? '🟡' : '🔴';

      // Format the featured spot (best overall)
      const featuredSpot = {
        name: bestSpots[0].spot_name,
        highlight: bestSpots[0].match_summary,
        reason: bestSpots[0].match_conditions,
        wave: bestSpots[0].wave_height,
        conditions: bestSpots[0].conditions,
        skill: bestSpots[0].skill_match,
        board: bestSpots[0].best_board,
        air: bestSpots[0].air_temp,
        cloud: bestSpots[0].clouds,
        rain: bestSpots[0].rain_chance,
        wind: bestSpots[0].wind_description,
        water: bestSpots[0].water_temp,
        wetsuit: bestSpots[0].gear,
        best_time: bestSpots[0].prime_time,
        alt_time: bestSpots[0].backup_time,
        tip1: bestSpots[0].tip1,
        tip2: bestSpots[0].tip2,
        tip3: bestSpots[0].tip3
      };

      // Format remaining spots (2nd and 3rd best)
      const otherSpots = bestSpots.slice(1).map(spot => {
        const tideData = spot.weatherData?.current?.buoyData?.tide;
        console.log(`[TIDE_DATA] Spot ${spot.spot_name}: ${tideData ? `Tide: ${tideData}ft` : 'No tide data available'}`);
        return {
          name: spot.spot_name,
          highlight: spot.match_summary,
          wave: spot.wave_height,
          conditions: spot.conditions,
          skill: spot.skill_match,
          board: spot.best_board,
          best_time: spot.prime_time,
          alt_time: spot.backup_time,
          tide: tideData ? `${tideData}ft` : 'No tide data available'
        };
      });

      // Prepare template data
      const templateData = {
        user_name: user.displayName || 'Surfer',
        featured_spot: featuredSpot,
        spots: otherSpots,
        total_spots: bestSpots.length,
        diary_url: "https://kook-cast.com/diary/new-session",
        subject: `${conditionEmoji} Go surf at ${bestSpots[0].prime_time} at ${bestSpots[0].spot_name}`
      };

      // Send ONE premium email
      console.log(`[SENDING_EMAIL] Sending single email to ${user.email} with ${bestSpots.length} locations`);
      const emailResult = await sgMail.send({
        to: user.email,
        from: {
          email: fromEmail,
          name: "KookCast"
        },
        subject: `${conditionEmoji} Go surf at ${bestSpots[0].prime_time} at ${bestSpots[0].spot_name}`,
        templateId: premiumTemplateId,
        dynamicTemplateData: templateData
      });

      console.log(`[TEST_SEND_EMAILS_SUCCESS] Sent premium email to ${email} with ${bestSpots.length} spots`);
      
      return res.json({
        status: 'success',
        message: 'Test email sent successfully',
        details: {
          locations_processed: locations.length,
          valid_reports: validReports.length,
          selected_spots: bestSpots.length,
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
  schedule: '0 5 * * *',  // 5 AM LA time
  timeZone: 'America/Los_Angeles',  // California timezone
  retryCount: 0,
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridPremiumTemplateId, openaiApiKey, worldTidesApiKey],
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

        // Score each spot based on multiple factors
        const scoredSpots = validReports.map(spot => {
          // Get skill match percentage
          const skillMatch = parseInt(spot.skill_match.replace('%', ''));
          
          // Get tide data
          const tideData = spot.weatherData?.current?.buoyData;
          const tideScore = tideData ? {
            current: tideData.tide,
            trend: tideData.tideTrend,
            nextHigh: tideData.nextHighTide,
            nextLow: tideData.nextLowTide,
            range: tideData.tideRange
          } : null;
          
          // Get wave data
          const waveData = spot.weatherData?.current;
          const waveScore = waveData ? {
            height: waveData.waveHeight,
            period: waveData.swellPeriod,
            direction: waveData.swellDirection
          } : null;
          
          // Get wind data
          const windData = spot.weatherData?.current;
          const windScore = windData ? {
            speed: windData.windSpeed,
            direction: windData.windDirection,
            gusts: windData.windGusts
          } : null;
          
          // Calculate overall score
          let overallScore = skillMatch; // Base score on skill match
          
          // Add tide score if available
          if (tideScore) {
            if (tideScore.trend === 'rising') overallScore += 10;
            if (tideScore.range && tideScore.range.range > 2 && tideScore.range.range < 6) overallScore += 5;
          }
          
          // Add wave score if available
          if (waveScore) {
            if (waveScore.height > 2 && waveScore.height < 6) overallScore += 10;
            if (waveScore.period > 8) overallScore += 5;
          }
          
          // Add wind score if available
          if (windScore) {
            if (windScore.speed < 10) overallScore += 10;
            if (windScore.direction > 180 && windScore.direction < 360) overallScore += 5;
          }
          
          return {
            ...spot,
            score: overallScore,
            tideData,
            waveData,
            windData
          };
        });

        // Sort spots by score and take top 3
        const bestSpots = scoredSpots
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        console.log(`[BEST_SPOTS] Selected top 3 spots for ${user.email}:`, 
          bestSpots.map(spot => `${spot.spot_name} (Score: ${spot.score})`));

        // Format the featured spot (best overall)
        const featuredSpot = {
          name: bestSpots[0].spot_name,
          highlight: bestSpots[0].match_summary,
          reason: bestSpots[0].match_conditions,
          wave: bestSpots[0].wave_height,
          conditions: bestSpots[0].conditions,
          skill: bestSpots[0].skill_match,
          board: bestSpots[0].best_board,
          air: bestSpots[0].air_temp,
          cloud: bestSpots[0].clouds,
          rain: bestSpots[0].rain_chance,
          wind: bestSpots[0].wind_description,
          water: bestSpots[0].water_temp,
          wetsuit: bestSpots[0].gear,
          best_time: bestSpots[0].prime_time,
          alt_time: bestSpots[0].backup_time,
          tide: bestSpots[0].tideData ? {
            current: `${bestSpots[0].tideData.tide}ft`,
            trend: bestSpots[0].tideData.tideTrend,
            nextHigh: bestSpots[0].tideData.nextHighTide ? {
              time: bestSpots[0].tideData.nextHighTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              height: `${bestSpots[0].tideData.nextHighTide.height}ft`
            } : null,
            nextLow: bestSpots[0].tideData.nextLowTide ? {
              time: bestSpots[0].tideData.nextLowTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              height: `${bestSpots[0].tideData.nextLowTide.height}ft`
            } : null,
            range: bestSpots[0].tideData.tideRange ? {
              min: `${bestSpots[0].tideData.tideRange.min}ft`,
              max: `${bestSpots[0].tideData.tideRange.max}ft`,
              range: `${bestSpots[0].tideData.tideRange.range}ft`
            } : null
          } : 'No tide data available',
          swell: bestSpots[0].swell_data
        };

        // Format additional spots (2nd and 3rd best)
        const additionalSpots = bestSpots.slice(1).map(spot => {
          const tideData = spot.tideData;
          console.log(`[TIDE_DATA] Spot ${spot.spot_name}: ${tideData ? `Tide: ${tideData.tide}ft (${tideData.tideTrend})` : 'No tide data available'}`);
          return {
            name: spot.spot_name,
            highlight: spot.match_summary,
            reason: spot.match_conditions,
            wave: spot.wave_height,
            conditions: spot.conditions,
            skill: spot.skill_match,
            board: spot.best_board,
            air: spot.air_temp,
            cloud: spot.clouds,
            rain: spot.rain_chance,
            wind: spot.wind_description,
            water: spot.water_temp,
            wetsuit: spot.gear,
            best_time: spot.prime_time,
            alt_time: spot.backup_time,
            tide: tideData ? {
              current: `${tideData.tide}ft`,
              trend: tideData.tideTrend,
              nextHigh: tideData.nextHighTide ? {
                time: tideData.nextHighTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                height: `${tideData.nextHighTide.height}ft`
              } : null,
              nextLow: tideData.nextLowTide ? {
                time: tideData.nextLowTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                height: `${tideData.nextLowTide.height}ft`
              } : null,
              range: tideData.tideRange ? {
                min: `${tideData.tideRange.min}ft`,
                max: `${tideData.tideRange.max}ft`,
                range: `${tideData.tideRange.range}ft`
              } : null
            } : 'No tide data available',
            swell: spot.swell_data
          };
        });

        // Prepare email template data
        const templateData = {
          featured_spot: {
            name: featuredSpot.spot_name,
            highlight: featuredSpot.match_summary,
            reason: featuredSpot.match_conditions,
            wave: featuredSpot.wave_height,
            conditions: featuredSpot.conditions,
            skill: featuredSpot.skill_match,
            board: featuredSpot.best_board,
            air: featuredSpot.air_temp,
            cloud: featuredSpot.clouds,
            rain: featuredSpot.rain_chance,
            wind: featuredSpot.wind_description,
            water: featuredSpot.water_temp,
            wetsuit: featuredSpot.gear,
            best_time: featuredSpot.prime_time,
            alt_time: featuredSpot.backup_time,
            tip1: featuredSpot.tip1,
            tip2: featuredSpot.tip2,
            tip3: featuredSpot.tip3,
            daily_challenge: featuredSpot.daily_challenge,
            skill_focus: featuredSpot.skill_focus
          },
          additional_spots: additionalSpots,
          user_name: userData.name || 'Surfer',
          date: today.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'America/Los_Angeles'
          }),
          diary_url: "https://kook-cast.com/diary/new-session",
          subject: `${conditionEmoji} Go surf at ${featuredSpot.prime_time} at ${featuredSpot.spot_name}`
        };

        // Send ONE premium email
        console.log(`[SENDING_EMAIL] Sending single email to ${user.email} with ${validReports.length} locations`);
        const emailResult = await sgMail.send({
          to: user.email,
          from: {
            email: fromEmail,
            name: "KookCast"
          },
          subject: `${conditionEmoji} Go surf at ${featuredSpot.prime_time} at ${featuredSpot.spot_name}`,
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
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridTemplateId, openaiApiKey, worldTidesApiKey],
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

// Test endpoint for tide data
app.post('/test-tide-data', async (req, res) => {
  try {
    const { latitude, longitude, location } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        status: 'error',
        message: 'Latitude and longitude are required'
      });
    }

    console.log(`[TIDE_TEST] Testing tide data for coordinates ${latitude},${longitude}`);
    
    // Find closest station
    const closestStation = BuoyData.findClosestStation(latitude, longitude);
    if (!closestStation) {
      return res.status(404).json({
        status: 'error',
        message: 'No nearby station found'
      });
    }

    console.log(`[TIDE_TEST] Using station ${closestStation.name} (${closestStation.id})`);
    
    // Fetch station data
    const stationData = await BuoyData.fetchStationData(closestStation.id, latitude, longitude);
    if (!stationData) {
      return res.status(404).json({
        status: 'error',
        message: 'Failed to fetch station data'
      });
    }

    // Get enhanced tide data
    const enhancedData = await BuoyData.enhanceTideData(stationData, latitude, longitude);
    
    res.json({
      status: 'success',
      location: location || 'Unknown',
      station: closestStation.name,
      tide_data: {
        current: enhancedData.tide ? `${enhancedData.tide}ft` : 'No current tide data',
        trend: enhancedData.tideTrend || 'unknown',
        nextHigh: enhancedData.nextHighTide ? {
          time: enhancedData.nextHighTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          height: `${enhancedData.nextHighTide.height}ft`
        } : null,
        nextLow: enhancedData.nextLowTide ? {
          time: enhancedData.nextLowTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          height: `${enhancedData.nextLowTide.height}ft`
        } : null,
        range: enhancedData.tideRange ? {
          min: `${enhancedData.tideRange.min}ft`,
          max: `${enhancedData.tideRange.max}ft`,
          range: `${enhancedData.tideRange.range}ft`
        } : null
      }
    });
  } catch (error) {
    console.error('[TIDE_TEST] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch tide data',
      error: error.message
    });
  }
});

// Test endpoint for premium email data without sending
app.post('/test-premium-data', async (req, res) => {
  try {
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

    console.log(`[TEST_PREMIUM_DATA] Processing user ${email} (${userId}) with premium status: ${user.premium}`);

    // Get user's surf locations
    const userData = await getUserData(userId);
    const surfLocations = userData.surfLocations || [];

    if (surfLocations.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'User has no surf locations set'
      });
    }

    const openAiApiKey = openaiApiKey.value();

    // Process all locations in parallel
    console.log(`[TEST_PREMIUM_DATA] Processing ${surfLocations.length} locations in parallel`);
    const startTime = Date.now();
    
    const spotReports = await Promise.all(
      surfLocations.map(async (location) => {
        if (!location) return null;
        console.log(`[TEST_PREMIUM_DATA] Processing location: ${location}`);
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
    console.log(`[TEST_PREMIUM_DATA] Parallel processing took ${endTime - startTime}ms`);

    // Filter out any null results
    const validReports = spotReports.filter(report => report !== null);
    console.log(`[TEST_PREMIUM_DATA] Generated ${validReports.length} valid reports`);

    // Score each spot based on multiple factors
    const scoredSpots = validReports.map(spot => {
      // Get skill match percentage
      const skillMatch = parseInt(spot.skill_match.replace('%', ''));
      
      // Get tide data
      const tideData = spot.weatherData?.current?.buoyData;
      const tideScore = tideData ? {
        current: tideData.tide,
        trend: tideData.tideTrend,
        nextHigh: tideData.nextHighTide,
        nextLow: tideData.nextLowTide,
        range: tideData.tideRange
      } : null;
      
      // Get wave data
      const waveData = spot.weatherData?.current;
      const waveScore = waveData ? {
        height: waveData.waveHeight,
        period: waveData.swellPeriod,
        direction: waveData.swellDirection
      } : null;
      
      // Get wind data
      const windData = spot.weatherData?.current;
      const windScore = windData ? {
        speed: windData.windSpeed,
        direction: windData.windDirection,
        gusts: windData.windGusts
      } : null;
      
      // Calculate overall score
      let overallScore = skillMatch; // Base score on skill match
      
      // Add tide score if available
      if (tideScore) {
        if (tideScore.trend === 'rising') overallScore += 10;
        if (tideScore.range && tideScore.range.range > 2 && tideScore.range.range < 6) overallScore += 5;
      }
      
      // Add wave score if available
      if (waveScore) {
        if (waveScore.height > 2 && waveScore.height < 6) overallScore += 10;
        if (waveScore.period > 8) overallScore += 5;
      }
      
      // Add wind score if available
      if (windScore) {
        if (windScore.speed < 10) overallScore += 10;
        if (windScore.direction > 180 && windScore.direction < 360) overallScore += 5;
      }
      
      return {
        ...spot,
        score: overallScore,
        tideData,
        waveData,
        windData
      };
    });

    // Sort spots by score and take top 3
    const bestSpots = scoredSpots
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    console.log(`[TEST_PREMIUM_DATA] Selected top 3 spots:`, 
      bestSpots.map(spot => `${spot.spot_name} (Score: ${spot.score})`));

    // Format the data as it would appear in the email
    const emailData = {
      featured_spot: {
        name: bestSpots[0].spot_name,
        highlight: bestSpots[0].match_summary,
        reason: bestSpots[0].match_conditions,
        wave: bestSpots[0].wave_height,
        conditions: bestSpots[0].conditions,
        skill: bestSpots[0].skill_match,
        board: bestSpots[0].best_board,
        air: bestSpots[0].air_temp,
        cloud: bestSpots[0].clouds,
        rain: bestSpots[0].rain_chance,
        wind: bestSpots[0].wind_description,
        water: bestSpots[0].water_temp,
        wetsuit: bestSpots[0].gear,
        best_time: bestSpots[0].prime_time,
        alt_time: bestSpots[0].backup_time,
        tip1: bestSpots[0].tip1,
        tip2: bestSpots[0].tip2,
        tip3: bestSpots[0].tip3,
        tide: bestSpots[0].tideData ? {
          current: `${bestSpots[0].tideData.tide}ft`,
          trend: bestSpots[0].tideData.tideTrend,
          nextHigh: bestSpots[0].tideData.nextHighTide ? {
            time: bestSpots[0].tideData.nextHighTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            height: `${bestSpots[0].tideData.nextHighTide.height}ft`
          } : null,
          nextLow: bestSpots[0].tideData.nextLowTide ? {
            time: bestSpots[0].tideData.nextLowTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            height: `${bestSpots[0].tideData.nextLowTide.height}ft`
          } : null,
          range: bestSpots[0].tideData.tideRange ? {
            min: `${bestSpots[0].tideData.tideRange.min}ft`,
            max: `${bestSpots[0].tideData.tideRange.max}ft`,
            range: `${bestSpots[0].tideData.tideRange.range}ft`
          } : null
        } : 'No tide data available'
      },
      other_spots: bestSpots.slice(1).map(spot => ({
        name: spot.spot_name,
        highlight: spot.match_summary,
        wave: spot.wave_height,
        conditions: spot.conditions,
        skill: spot.skill_match,
        board: spot.best_board,
        best_time: spot.prime_time,
        alt_time: spot.backup_time,
        tide: spot.tideData ? {
          current: `${spot.tideData.tide}ft`,
          trend: spot.tideData.tideTrend,
          nextHigh: spot.tideData.nextHighTide ? {
            time: spot.tideData.nextHighTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            height: `${spot.tideData.nextHighTide.height}ft`
          } : null,
          nextLow: spot.tideData.nextLowTide ? {
            time: spot.tideData.nextLowTide.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            height: `${spot.tideData.nextLowTide.height}ft`
          } : null,
          range: spot.tideData.tideRange ? {
            min: `${spot.tideData.tideRange.min}ft`,
            max: `${spot.tideData.tideRange.max}ft`,
            range: `${spot.tideData.tideRange.range}ft`
          } : null
        } : 'No tide data available'
      })),
      debug_info: {
        total_spots: validReports.length,
        processing_time_ms: endTime - startTime,
        spot_scores: bestSpots.map(spot => ({
          name: spot.spot_name,
          score: spot.score,
          skill_match: spot.skill_match,
          tide_data: spot.tideData,
          wave_data: spot.waveData,
          wind_data: spot.windData
        }))
      }
    };

    res.json({
      status: 'success',
      message: 'Premium email data generated successfully',
      data: emailData
    });
  } catch (error) {
    console.error('[TEST_PREMIUM_DATA] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate premium email data',
      error: error.message
    });
  }
});
