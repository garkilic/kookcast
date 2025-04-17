const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const OpenAI = require('openai');
const { defineSecret } = require('firebase-functions/params');

// Define secrets
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');
const sendgridFromEmail = defineSecret('SENDGRID_FROM_EMAIL');
const sendgridTemplateId = defineSecret('SENDGRID_TEMPLATE_ID');
const openaiApiKey = defineSecret('OPENAI_API_KEY');

// Initialize Firebase Admin
admin.initializeApp();

// Test configuration
const testConfig = {
  testEmail: 'garkilic@gmail.com',
  testLocation: 'Santa Cruz'
};

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
          
          Format the response as a JSON object with these exact keys:
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
          
          The full_report should be a detailed narrative of all conditions.`
        },
        {
          role: "user",
          content: `Generate a surf report for ${location}`
        }
      ],
      model: "gpt-4",
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error('Error generating surf report:', error);
    throw error;
  }
}

async function sendTestEmail() {
  try {
    // Get secrets
    const apiKey = openaiApiKey.value();
    const sgApiKey = sendgridApiKey.value();
    const fromEmail = sendgridFromEmail.value();
    const templateId = sendgridTemplateId.value();

    // Generate surf report
    const surfReport = await generateSurfReport(testConfig.testLocation, apiKey);
    
    // Format template data using AI-generated content
    const templateData = {
      subject: testConfig.testLocation + " Surf Report - " + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
      email_header: "📋 Daily Surf Report",
      forecast_title: `${testConfig.testLocation} Forecast`,
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

    // Set up SendGrid
    sgMail.setApiKey(sgApiKey);

    // Send email
    await sgMail.send({
      to: testConfig.testEmail,
      from: fromEmail,
      templateId: templateId,
      dynamicTemplateData: templateData
    });

    console.log('Test email sent successfully!');
    console.log('Generated surf report:', surfReport);
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
sendTestEmail(); 