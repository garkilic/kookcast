const functions = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const sgMail = require('@sendgrid/mail');
const OpenAI = require('openai');

// Test function
exports.helloWorld = onRequest((request, response) => {
  logger.info("Test function called!", {structuredData: true});
  response.json({
    message: "Hello from Firebase!",
    timestamp: new Date().toISOString(),
    status: "success"
  });
});

// Test surf forecast function with simulated data
exports.testSurfForecast = onRequest(async (request, response) => {
  try {
    // Get API keys from environment variables
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!SENDGRID_API_KEY || !OPENAI_API_KEY) {
      throw new Error('API keys not found in environment variables');
    }

    // Set up SendGrid
    sgMail.setApiKey(SENDGRID_API_KEY);

    // Set up OpenAI
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    });

    // Simulated surf spot data
    const spot = {
      name: "Ocean Beach",
      region: "San Francisco",
      type: "beach break",
      idealSurferType: "intermediate to advanced",
      localTips: "Watch out for strong currents and cold water",
      latitude: 37.7599,
      longitude: -122.5108
    };

    // Simulated StormGlass data
    const conditions = {
      waveHeight: { noaa: 4.2 },
      swellHeight: { noaa: 3.8 },
      swellPeriod: { noaa: 12 },
      swellDirection: { noaa: 270 },
      windSpeed: { noaa: 5 },
      windDirection: { noaa: 180 }
    };

    // Simulated WorldTides data
    const tide = {
      type: "high",
      date: new Date().toISOString()
    };

    // Create prompt for OpenAI
    const prompt = `Write a short, friendly surf forecast for ${spot.name} in ${spot.region}. 
    This is a ${spot.type} spot suited for: ${spot.idealSurferType}. 
    Local tips: ${spot.localTips}. 
    Current conditions: wave height ${conditions.waveHeight.noaa}m, 
    swell ${conditions.swellHeight.noaa}m @ ${conditions.swellPeriod.noaa}s from ${conditions.swellDirection.noaa}°. 
    Wind: ${conditions.windSpeed.noaa} m/s from ${conditions.windDirection.noaa}°. 
    Tide: ${tide.type} at ${tide.date}. 
    Recommend if this person should go today, and what to expect.`;

    // Get forecast from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });

    const forecastText = completion.choices[0].message.content;

    // Send email with forecast
    const msg = {
      to: request.query.email || 'test@example.com',
      from: 'griffin@kook-cast.com',
      subject: `Your Surf Forecast for ${spot.name}`,
      text: forecastText,
      html: `<strong>${forecastText}</strong>`
    };

    await sgMail.send(msg);
    
    response.json({
      status: 'success',
      message: 'Forecast generated and email sent successfully',
      forecast: forecastText
    });
  } catch (error) {
    logger.error('Error in testSurfForecast:', error);
    response.status(500).json({
      status: 'error',
      message: 'Failed to generate forecast',
      error: error.message
    });
  }
}); 