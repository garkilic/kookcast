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
    
    res.json({
      status: 'success',
      message: 'Email system check complete',
      stats: {
        total_verified_users: userCount,
        users_with_locations: usersWithLocation,
        next_scheduled_run: new Date(new Date().setHours(5,0,0,0)).toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles'
        }),
        current_time: new Date().toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles'
        })
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
        const subject = `Go surf at ${surfReport.best_time} at ${formattedLocation}`;

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
                
                Generate a surf report for ${formattedLocation} on ${formattedDate}. 
                Use ONLY the provided weather data to make your assessment. Do not make up or modify any dates.
                The go_today field MUST be either 'yes', 'no', or 'maybe' - no other values are allowed.
                
                For best_time and second_best_time, analyze the provided tide, wind, and swell data to determine:
                - The optimal time window when conditions align best for surfing
                - A secondary time window as a backup option
                These times MUST be based on the actual forecast data provided, considering:
                - Tide conditions
                - Wind speed and direction
                - Wave height and period
                - Swell direction
                - Weather conditions
                
                Format time ranges exactly as "X:XX AM/PM - Y:YY AM/PM" (e.g. "6:30 AM - 9:00 AM")
                
                For each field, generate dynamic content based on the actual data, writing as if you're personally guiding the surfer:
                - vibe_description: Describe the overall surf conditions and atmosphere in a warm, encouraging way
                - best_time: The optimal time window for surfing, explaining why it's the best time
                - second_best_time: The secondary time window for surfing, explaining why it's a good alternative
                - gear: Suggest appropriate board and wetsuit based on conditions, explaining your recommendation
                - water_temp: Describe the water temperature conditions in a way that helps prepare the surfer
                - wind_description: Detail the wind speed, direction, and how it affects the surf, explaining what to expect
                - go_today: Whether to surf today (yes/no/maybe), with a brief explanation of your recommendation
                - go_reasoning: Explain the swell conditions, size, period, and direction in a way that helps the surfer understand
                - weather_summary: Describe the overall weather conditions in an encouraging, helpful way
                - air_temp: Describe the air temperature conditions to help with preparation
                - clouds: Describe the cloud cover conditions and how they affect the session
                - rain_chance: Describe the precipitation probability and its impact on the session
                - tide_summary: Explain the tide movement and its impact on the break in a way that helps the surfer time their session
                - skill_focus: Suggest a specific skill to focus on based on conditions, explaining why it's a good opportunity
                - daily_challenge: Provide a specific challenge to try based on conditions, making it fun and achievable
                
                Format your response as a JSON object with the following structure:
                {
                  "vibe": "warm, encouraging description based on all conditions",
                  "best_time": "X:XX AM/PM - Y:YY AM/PM based on forecast",
                  "second_best": "X:XX AM/PM - Y:YY AM/PM based on forecast",
                  "gear_recommendation": "personalized suggestion based on conditions",
                  "water_temp": "helpful description based on water temperature",
                  "wind_summary": "detailed description based on wind data",
                  "go_today": "yes/no/maybe",
                  "swell_summary": "clear explanation based on swell data",
                  "weather_summary": "encouraging description based on weather data",
                  "air_temp": "preparatory description based on air temperature",
                  "clouds": "helpful description based on cloud cover",
                  "rain_chance": "clear description based on precipitation",
                  "tide_summary": "helpful explanation based on tide data",
                  "skill_focus": "personalized suggestion based on conditions",
                  "daily_challenge": "fun, achievable challenge based on conditions"
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
            location: formattedLocation,
            date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
            vibe_description: surfReport.vibe,
            best_time: surfReport.best_time,
            second_best_time: surfReport.second_best,
            gear: surfReport.gear_recommendation,
            water_temp: weatherDescriptions.water_temp,
            wind_description: surfReport.wind_summary,
            go_today: surfReport.go_today,
            go_reasoning: surfReport.swell_summary,
            weather_summary: weatherDescriptions.weather_summary,
            air_temp: weatherDescriptions.air_temp,
            clouds: weatherDescriptions.clouds,
            rain_chance: weatherDescriptions.rain_chance,
            tide_summary: weatherDescriptions.tide_summary,
            skill_focus: surfReport.skill_focus || CONFIG.DEFAULT_SKILL_FOCUS,
            daily_challenge: surfReport.daily_challenge || CONFIG.DEFAULT_DAILY_CHALLENGE,
            yes_url: CONFIG.CHECKIN_URLS.yes,
            no_url: CONFIG.CHECKIN_URLS.no,
            skipped_url: CONFIG.CHECKIN_URLS.skipped,
            subject: `${conditionEmoji} Go surf at ${surfReport.best_time} at ${formattedLocation}`,
            user_boards: surfReport.userData.boards,
            recent_diary_entries: surfReport.userData.recentDiaryEntries
          };

          msg = {
            to: req.body.to,
            from: fromEmail,
            subject: subject,
            templateId: templateId,
            dynamicTemplateData: templateData
          };
        } catch (error) {
          console.error('Error generating weather descriptions:', error);
          throw new Error('Failed to generate weather descriptions');
        }
      } catch (error) {
        console.error(`[AI_ERROR] Failed to generate report for ${req.body.location}:`, error);
        throw new Error('Failed to generate surf report');
      }
    } else {
      msg = {
        to: req.body.to,
        from: fromEmail,
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
    
    // Format user's boards and diary entries for context
    const userContext = userData ? `
User's surfboards: ${userData.userBoards || 'No boards selected'}
Recent surf sessions:
${(userData.recentDiaryEntries || []).map(entry => 
  `- ${entry.date}: ${entry.rating} (${entry.hadFun ? 'had fun' : 'did not have fun'})${entry.description ? ` - ${entry.description}` : ''}`
).join('\n')}
` : '';

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are an experienced surf coach with decades of experience teaching surfers of all levels. 
          Your tone is warm, encouraging, and deeply knowledgeable. You write as if you're personally guiding each surfer, 
          using phrases like "I've been watching the conditions" and "I think you'll love this spot today." 
          You're incredibly kind and supportive, always finding the positive in any conditions while being honest about challenges.
          
          Consider the user's surfboards and recent surf sessions when making recommendations:
          ${userContext}
          
          Generate a surf report for ${formattedLocation} on ${formattedDate}. 
          Use ONLY the provided weather data to make your assessment. Do not make up or modify any dates.
          The go_today field MUST be either 'yes', 'no', or 'maybe' - no other values are allowed.
          
          For best_time and second_best_time, analyze the provided tide, wind, and swell data to determine:
          - The optimal time window when conditions align best for surfing
          - A secondary time window as a backup option
          These times MUST be based on the actual forecast data provided, considering:
          - Tide conditions
          - Wind speed and direction
          - Wave height and period
          - Swell direction
          - Weather conditions
          
          Format time ranges exactly as "X:XX AM/PM - Y:YY AM/PM" (e.g. "6:30 AM - 9:00 AM")
          
          For each field, generate dynamic content based on the actual data, writing as if you're personally guiding the surfer:
          - vibe_description: Describe the overall surf conditions and atmosphere in a warm, encouraging way
          - best_time: The optimal time window for surfing, explaining why it's the best time
          - second_best_time: The secondary time window for surfing, explaining why it's a good alternative
          - gear: Suggest appropriate board and wetsuit based on conditions, explaining your recommendation
          - water_temp: Describe the water temperature conditions in a way that helps prepare the surfer
          - wind_description: Detail the wind speed, direction, and how it affects the surf, explaining what to expect
          - go_today: Whether to surf today (yes/no/maybe), with a brief explanation of your recommendation
          - go_reasoning: Explain the swell conditions, size, period, and direction in a way that helps the surfer understand
          - weather_summary: Describe the overall weather conditions in an encouraging, helpful way
          - air_temp: Describe the air temperature conditions to help with preparation
          - clouds: Describe the cloud cover conditions and how they affect the session
          - rain_chance: Describe the precipitation probability and its impact on the session
          - tide_summary: Explain the tide movement and its impact on the break in a way that helps the surfer time their session
          - skill_focus: Suggest a specific skill to focus on based on conditions, explaining why it's a good opportunity
          - daily_challenge: Provide a specific challenge to try based on conditions, making it fun and achievable
          
          Format your response as a JSON object with the following structure:
          {
            "vibe": "warm, encouraging description based on all conditions",
            "best_time": "X:XX AM/PM - Y:YY AM/PM based on forecast",
            "second_best": "X:XX AM/PM - Y:YY AM/PM based on forecast",
            "gear_recommendation": "personalized suggestion based on conditions",
            "water_temp": "helpful description based on water temperature",
            "wind_summary": "detailed description based on wind data",
            "go_today": "yes/no/maybe",
            "swell_summary": "clear explanation based on swell data",
            "weather_summary": "encouraging description based on weather data",
            "air_temp": "preparatory description based on air temperature",
            "clouds": "helpful description based on cloud cover",
            "rain_chance": "clear description based on precipitation",
            "tide_summary": "helpful explanation based on tide data",
            "skill_focus": "personalized suggestion based on conditions",
            "daily_challenge": "fun, achievable challenge based on conditions"
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
  MAX_REQUESTS: 10,
  WINDOW_MS: 60 * 1000, // 1 minute

  checkRateLimit(ip) {
    const now = Date.now();
    const userRequests = this.requests.get(ip) || [];
    
    // Remove old requests
    const recentRequests = userRequests.filter(time => now - time < this.WINDOW_MS);
    
    if (recentRequests.length >= this.MAX_REQUESTS) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      };
    }
    
    recentRequests.push(now);
    this.requests.set(ip, recentRequests);
    return { success: true };
  }
};

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

// Main surf report generation function
async function generateSurfReport(location, surferType, userId, apiKey, userData = null) {
  try {
    console.log('[INFO] Generating surf report:', {
      location,
      surferType,
      userId,
      timestamp: new Date().toISOString()
    });

    // Initialize userData if not provided
    if (!userData) {
      userData = {
        userBoards: 'No boards selected',
        recentDiaryEntries: []
      };

      // Only fetch from Firestore if userId is provided
      if (userId) {
        try {
          const userDoc = await admin.firestore().collection('users').doc(userId).get();
          const userDataFromFirestore = userDoc.data();
          
          if (userDataFromFirestore) {
            // Get user's surfboards
            const boardTypes = userDataFromFirestore.boardTypes || [];
            const boardLabels = {
              shortboard: 'Shortboard',
              longboard: 'Longboard',
              fish: 'Fish',
              hybrid: 'Hybrid',
              funboard: 'Funboard',
              gun: 'Gun',
              softtop: 'Soft Top'
            };
            const formattedBoards = boardTypes.map(board => boardLabels[board]).join(', ') || 'No boards selected';

            // Get user's recent diary entries for context
            const diaryEntries = await admin.firestore()
              .collection('users')
              .doc(userId)
              .collection('surfEntries')
              .orderBy('timestamp', 'desc')
              .limit(5)
              .get();

            const recentEntries = diaryEntries.docs.map(doc => {
              const data = doc.data();
              return {
                date: new Date(data.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
                rating: data.rating,
                hadFun: data.hadFun,
                description: data.description
              };
            });

            userData = {
              userBoards: formattedBoards,
              recentDiaryEntries: recentEntries
            };
          }
        } catch (error) {
          console.error('[ERROR] Failed to fetch user data:', error);
          // Continue with default userData if fetch fails
        }
      }
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
  schedule: '0 5 * * *',
  timeZone: 'America/Los_Angeles',
  retryCount: 3,
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridTemplateId, openaiApiKey],
  memory: '256MiB'
}, async (event) => {
  try {
    console.log('[SCHEDULED_REPORTS] Starting daily surf report distribution');
    
    // Get all users with emailVerified = true
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('emailVerified', '==', true)
      .get();
    
    // Log all verified users for debugging
    console.log('[SCHEDULED_REPORTS] Verified users:', usersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        email: data.email,
        surfLocations: data.surfLocations,
        emailVerified: data.emailVerified,
        emailVerifiedAt: data.emailVerifiedAt
      };
    }));
    
    console.log(`[SCHEDULED_REPORTS] Found ${usersSnapshot.size} verified users`);

    const sendGridApiKey = sendgridApiKey.value();
    const fromEmail = sendgridFromEmail.value();
    const templateId = sendgridTemplateId.value();
    const openAiApiKey = openaiApiKey.value();

    // Log SendGrid configuration (without sensitive data)
    console.log('[SCHEDULED_REPORTS] SendGrid Configuration:', {
      fromEmail,
      templateId,
      hasApiKey: !!sendGridApiKey
    });

    sgMail.setApiKey(sendGridApiKey);

    // Process each user
    let successCount = 0;
    let errorCount = 0;
    let processedEmails = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data();
      
      // Get surf locations
      const surfLocations = user.surfLocations || [];
      
      console.log(`[PROCESSING_USER] User ${user.email}:`, {
        hasLocations: surfLocations.length > 0,
        locationCount: surfLocations.length,
        locations: surfLocations
      });
      
      if (surfLocations.length === 0) {
        console.log(`[SKIP_USER] User ${user.email} has no surf locations set`);
        continue;
      }

      try {
        // Process each surf location for the user
        for (const location of surfLocations) {
          console.log(`[PROCESSING_USER] Generating report for ${user.email} - Location: ${location}`);
          const surfReport = await generateSurfReport(location, user.surferType, user.uid, openAiApiKey, {
            userBoards: user.boardTypes,
            recentDiaryEntries: user.recentDiaryEntries
          });

          const formattedLocation = formatLocation(surfReport.location);
          const subject = `Go surf at ${surfReport.best_time} at ${formattedLocation}`;

          console.log(`[EMAIL_SUBJECT] Subject line: ${subject}`);

          // Determine condition emoji based on go_today value
          const conditionEmoji = surfReport.go_today === 'yes' ? '🟢' : 
                               surfReport.go_today === 'no' ? '🔴' : '🟡';

          // Format template data
          const templateData = {
            location: formattedLocation,
            date: surfReport.date,
            vibe_description: surfReport.vibe,
            best_time: surfReport.best_time,
            second_best_time: surfReport.second_best,
            gear: surfReport.gear_recommendation,
            water_temp: surfReport.water_temp,
            wind_description: surfReport.wind_summary,
            go_today: surfReport.go_today,
            go_reasoning: surfReport.swell_summary,
            weather_summary: surfReport.weather_summary,
            air_temp: surfReport.air_temp,
            clouds: surfReport.clouds,
            rain_chance: surfReport.rain_chance,
            tide_summary: surfReport.tide_summary,
            skill_focus: surfReport.skill_focus || CONFIG.DEFAULT_SKILL_FOCUS,
            daily_challenge: surfReport.daily_challenge || CONFIG.DEFAULT_DAILY_CHALLENGE,
            yes_url: CONFIG.CHECKIN_URLS.yes,
            no_url: CONFIG.CHECKIN_URLS.no,
            skipped_url: CONFIG.CHECKIN_URLS.skipped,
            subject: `${conditionEmoji} Go surf at ${surfReport.best_time} at ${formattedLocation}`
          };

          // Send email
          await sgMail.send({
            to: user.email,
            from: fromEmail,
            subject: subject,
            templateId: templateId,
            dynamicTemplateData: templateData
          });

          console.log(`[SUCCESS] Sent report to ${user.email} for location ${location}`);
          processedEmails.push(user.email);
        }
        successCount++;
      } catch (error) {
        console.error(`[USER_ERROR] Failed to process user ${user.email}:`, error);
        errorCount++;
      }
    }

    console.log('[SCHEDULED_REPORTS_COMPLETE]', {
      total_users: usersSnapshot.size,
      success_count: successCount,
      error_count: errorCount,
      processed_emails: processedEmails,
      timestamp: new Date().toISOString()
    });

    return { success: true, message: 'Surf reports sent successfully' };
  } catch (error) {
    console.error('[SCHEDULED_REPORTS_ERROR]', error);
    throw error;
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
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridTemplateId, openaiApiKey],
  memory: '256MiB'
}, async (req, res) => {
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
    const surfLocations = user.surfLocations || [];

    if (surfLocations.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'User has no surf locations set'
      });
    }

    const sendGridApiKey = sendgridApiKey.value();
    const fromEmail = sendgridFromEmail.value();
    const templateId = sendgridTemplateId.value();
    const openAiApiKey = openaiApiKey.value();

    sgMail.setApiKey(sendGridApiKey);

    // Process each surf location for the user
    for (const location of surfLocations) {
      console.log(`[TEST_SEND_EMAILS] Generating report for ${email} - Location: ${location}`);
      
      // Get user's recent diary entries for context
      const diaryEntries = await admin.firestore()
        .collection('users')
        .doc(userId)
        .collection('surfEntries')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

      const recentEntries = diaryEntries.docs.map(doc => {
        const data = doc.data();
        return {
          date: new Date(data.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
          rating: data.rating,
          hadFun: data.hadFun,
          description: data.description
        };
      });
      
      // Get user's boards
      const boardTypes = user.boardTypes || [];
      const boardLabels = {
        shortboard: 'Shortboard',
        longboard: 'Longboard',
        fish: 'Fish',
        hybrid: 'Hybrid',
        funboard: 'Funboard',
        gun: 'Gun',
        softtop: 'Soft Top'
      };
      const formattedBoards = boardTypes.map(board => boardLabels[board]).join(', ') || 'No boards selected';

      const surfReport = await generateSurfReport(location, user.surferType, userId, openAiApiKey, {
        recentDiaryEntries: recentEntries,
        userBoards: formattedBoards
      });

      const formattedLocation = formatLocation(surfReport.location);
      const subject = `Go surf at ${surfReport.best_time} at ${formattedLocation}`;

      // Determine condition emoji based on go_today value
      const conditionEmoji = surfReport.go_today === 'yes' ? '🟢' : 
                           surfReport.go_today === 'no' ? '🔴' : '🟡';

      // Format template data
      const templateData = {
        location: formattedLocation,
        date: surfReport.date,
        vibe_description: surfReport.vibe,
        best_time: surfReport.best_time,
        second_best_time: surfReport.second_best,
        gear: surfReport.gear_recommendation,
        water_temp: surfReport.water_temp,
        wind_description: surfReport.wind_summary,
        go_today: surfReport.go_today,
        go_reasoning: surfReport.swell_summary,
        weather_summary: surfReport.weather_summary,
        air_temp: surfReport.air_temp,
        clouds: surfReport.clouds,
        rain_chance: surfReport.rain_chance,
        tide_summary: surfReport.tide_summary,
        skill_focus: surfReport.skill_focus || CONFIG.DEFAULT_SKILL_FOCUS,
        daily_challenge: surfReport.daily_challenge || CONFIG.DEFAULT_DAILY_CHALLENGE,
        yes_url: CONFIG.CHECKIN_URLS.yes,
        no_url: CONFIG.CHECKIN_URLS.no,
        skipped_url: CONFIG.CHECKIN_URLS.skipped,
        subject: `${conditionEmoji} Go surf at ${surfReport.best_time} at ${formattedLocation}`,
        user_boards: surfReport.userData?.userBoards || formattedBoards,
        recent_diary_entries: surfReport.userData?.recentDiaryEntries || recentEntries
      };

      // Send email
      await sgMail.send({
        to: email,
        from: fromEmail,
        subject: subject,
        templateId: templateId,
        dynamicTemplateData: templateData
      });

      console.log(`[TEST_SEND_EMAILS] Successfully sent report to ${email} for location ${location}`);
    }

    res.json({
      status: 'success',
      message: 'Email distribution started. Check Firebase logs for progress.'
    });

  } catch (error) {
    console.error('[TEST_SEND_EMAILS] Error:', error);
    // Log error to Firestore
    await admin.firestore().collection('emailLogs').add({
      type: 'test_send_error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to send test email',
      error: error.message
    });
  }
});

// Manual trigger endpoint for sendSurfReports
exports.manualSendSurfReports = onRequest({
  cors: true,
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridTemplateId, openaiApiKey],
  memory: '256MiB'
}, async (req, res) => {
  try {
    console.log('[MANUAL_TRIGGER] Starting manual surf report distribution');
    
    // Get all users with emailVerified = true
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('emailVerified', '==', true)
      .get();
    
    console.log(`[MANUAL_TRIGGER] Found ${usersSnapshot.size} verified users`);

    const sendGridApiKey = sendgridApiKey.value();
    const fromEmail = sendgridFromEmail.value();
    const templateId = sendgridTemplateId.value();
    const openAiApiKey = openaiApiKey.value();

    sgMail.setApiKey(sendGridApiKey);

    // Process each user
    let successCount = 0;
    let errorCount = 0;
    let processedEmails = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data();
      const surfLocations = user.surfLocations || [];
      
      if (surfLocations.length === 0) {
        console.log(`[SKIP_USER] User ${user.email} has no surf locations set`);
        continue;
      }

      try {
        // Process each surf location for the user
        for (const location of surfLocations) {
          console.log(`[PROCESSING_USER] Generating report for ${user.email} - Location: ${location}`);
          const surfReport = await generateSurfReport(location, user.surferType, user.uid, openAiApiKey, {
            userBoards: user.boardTypes,
            recentDiaryEntries: user.recentDiaryEntries
          });

          const formattedLocation = formatLocation(surfReport.location);
          const subject = `Go surf at ${surfReport.best_time} at ${formattedLocation}`;

          // Determine condition emoji based on go_today value
          const conditionEmoji = surfReport.go_today === 'yes' ? '🟢' : 
                               surfReport.go_today === 'no' ? '🔴' : '🟡';

          // Format template data
          const templateData = {
            location: formattedLocation,
            date: surfReport.date,
            vibe_description: surfReport.vibe,
            best_time: surfReport.best_time,
            second_best_time: surfReport.second_best,
            gear: surfReport.gear_recommendation,
            water_temp: surfReport.water_temp,
            wind_description: surfReport.wind_summary,
            go_today: surfReport.go_today,
            go_reasoning: surfReport.swell_summary,
            weather_summary: surfReport.weather_summary,
            air_temp: surfReport.air_temp,
            clouds: surfReport.clouds,
            rain_chance: surfReport.rain_chance,
            tide_summary: surfReport.tide_summary,
            skill_focus: surfReport.skill_focus || CONFIG.DEFAULT_SKILL_FOCUS,
            daily_challenge: surfReport.daily_challenge || CONFIG.DEFAULT_DAILY_CHALLENGE,
            yes_url: CONFIG.CHECKIN_URLS.yes,
            no_url: CONFIG.CHECKIN_URLS.no,
            skipped_url: CONFIG.CHECKIN_URLS.skipped,
            subject: `${conditionEmoji} Go surf at ${surfReport.best_time} at ${formattedLocation}`
          };

          // Send email
          await sgMail.send({
            to: user.email,
            from: fromEmail,
            subject: subject,
            templateId: templateId,
            dynamicTemplateData: templateData
          });

          console.log(`[SUCCESS] Sent report to ${user.email} for location ${location}`);
          processedEmails.push(user.email);
        }
        successCount++;
      } catch (error) {
        console.error(`[USER_ERROR] Failed to process user ${user.email}:`, error);
        errorCount++;
      }
    }

    console.log('[MANUAL_TRIGGER_COMPLETE]', {
      total_users: usersSnapshot.size,
      success_count: successCount,
      error_count: errorCount,
      processed_emails: processedEmails,
      timestamp: new Date().toISOString()
    });

    res.json({
      status: 'success',
      message: 'Surf reports sent successfully',
      stats: {
        total_users: usersSnapshot.size,
        success_count: successCount,
        error_count: errorCount,
        processed_emails: processedEmails
      }
    });
  } catch (error) {
    console.error('[MANUAL_TRIGGER_ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send surf reports',
      error: error.message
    });
  }
});

// Start the server if we're not in Firebase Functions
if (process.env.NODE_ENV === 'development') {
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

// Export the Express app as a Firebase Function
exports.api = onRequest({
  cors: true,
  maxInstances: 10,
  memory: "256MiB",
  timeoutSeconds: 60,
  minInstances: 0,
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridTemplateId, openaiApiKey],
  invoker: "public"
}, app);

// Export the functions
module.exports = {
  ...module.exports,
  generateSurfReport,
  formatLocation
}; 