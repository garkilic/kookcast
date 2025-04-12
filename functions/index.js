const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const OpenAI = require('openai');

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

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Email service is running' });
});

// Email sending endpoint
app.post('/send', async (req, res) => {
  try {
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

    // If location is provided, generate AI report
    if (req.body.location) {
      try {
        console.log(`Generating surf report for ${req.body.location}`);
        const surfReport = await generateSurfReport(req.body.location, openAiKey);
        
        // Update template data with AI-generated content
        templateData = {
          ...templateData,
          subject: `${req.body.location} Surf Report - ${new Date().toLocaleDateString()}`,
          email_header: "🌊 Daily Surf Report",
          forecast_title: `${req.body.location} Forecast`,
          preview_text: surfReport.full_report.substring(0, 100),
          forecast_time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          main_alert: surfReport.main_alert,
          best_time_to_surf: surfReport.best_time,
          subheadline: surfReport.wave_size,
          conditions_summary: surfReport.full_report,
          wave_size: surfReport.wave_size,
          wind: surfReport.wind,
          water_temp: surfReport.water_temp,
          vibe: surfReport.vibe,
          morning_conditions: surfReport.morning_conditions,
          afternoon_conditions: surfReport.afternoon_conditions,
          tip1: surfReport.tips[0],
          tip2: surfReport.tips[1],
          tip3: surfReport.tips[2]
        };
      } catch (error) {
        console.error('Error generating surf report:', error);
        throw new Error('Failed to generate surf report');
      }
    }

    const msg = {
      to: req.body.to,
      from: fromEmail,
      subject: templateData.subject || req.body.subject,
      templateId: templateId,
      dynamicTemplateData: templateData
    };

    // Send email
    await sgMail.send(msg);
    
    res.json({
      status: 'success',
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send email',
      details: error.response ? error.response.body : error.message
    });
  }
});

// Generate surf report using OpenAI
async function generateSurfReport(location, apiKey) {
  try {
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a surf report generator. Generate a detailed surf report for ${location} with the following sections:
          1. Main Alert (one sentence summary)
          2. Wave Size and Conditions
          3. Wind Conditions
          4. Water Temperature
          5. Overall Vibe
          6. Best Time to Surf
          7. Morning Conditions (5:00-8:00am)
          8. Afternoon Conditions (4:00-6:00pm)
          9. Three Tips for Surfers
          
          IMPORTANT: Your response must be a valid JSON object with these exact keys and types:
          {
            "main_alert": "string",
            "wave_size": "string",
            "wind": "string",
            "water_temp": "string",
            "vibe": "string",
            "best_time": "string",
            "morning_conditions": "string",
            "afternoon_conditions": "string",
            "tips": ["string", "string", "string"],
            "full_report": "string"
          }
          
          The full_report should be a detailed narrative of all conditions. Do not include any text outside the JSON object.`
        },
        {
          role: "user",
          content: `Generate a surf report for ${location}`
        }
      ],
      model: "gpt-4"
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error('Error generating surf report:', error);
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
    // Get all users with surf locations
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('emailVerified', '==', true)
      .get();

    const sendGridApiKey = sendgridApiKey.value();
    const fromEmail = sendgridFromEmail.value();
    const templateId = sendgridTemplateId.value();
    const openAiApiKey = openaiApiKey.value();

    sgMail.setApiKey(sendGridApiKey);

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data();
      if (!user.surfLocation) continue;

      try {
        // Generate surf report
        const surfReport = await generateSurfReport(user.surfLocation, openAiApiKey);

        // Format template data
        const templateData = {
          subject: `${user.surfLocation} Surf Report - ${new Date().toLocaleDateString()}`,
          email_header: "🌊 Daily Surf Report",
          forecast_title: `${user.surfLocation} Forecast`,
          preview_text: surfReport.full_report.substring(0, 100),
          forecast_time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          main_alert: surfReport.main_alert,
          best_time_to_surf: surfReport.best_time,
          subheadline: surfReport.wave_size,
          conditions_summary: surfReport.full_report,
          wave_size: surfReport.wave_size,
          wind: surfReport.wind,
          water_temp: surfReport.water_temp,
          vibe: surfReport.vibe,
          morning_time: "5:00–8:00am",
          morning_conditions: surfReport.morning_conditions,
          afternoon_time: "4:00–6:00pm",
          afternoon_conditions: surfReport.afternoon_conditions,
          tip1: surfReport.tips[0],
          tip2: surfReport.tips[1],
          tip3: surfReport.tips[2],
          Sender_Name: "KookCast",
          Sender_Address: "123 Surf Lane",
          Sender_City: "San Francisco",
          Sender_State: "CA",
          Sender_Zip: "94121",
          unsubscribe: "https://kook-cast.com/unsubscribe",
          unsubscribe_preferences: "https://kook-cast.com/preferences"
        };

        // Send email
        await sgMail.send({
          to: user.email,
          from: fromEmail,
          templateId: templateId,
          dynamicTemplateData: templateData
        });

        console.log(`Surf report sent to ${user.email}`);
      } catch (error) {
        console.error(`Error processing user ${user.email}:`, error);
      }
    }

    return { success: true, message: 'Surf reports sent successfully' };
  } catch (error) {
    console.error('Error in sendSurfReports:', error);
    throw error;
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