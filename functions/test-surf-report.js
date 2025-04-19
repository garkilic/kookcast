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
  email: process.env.TEST_EMAIL || 'garkilic@gmail.com',
  location: process.env.TEST_LOCATION || 'Santa Cruz',
  sender: {
    name: process.env.SENDER_NAME || 'Griffin Arkilic',
    address: process.env.SENDER_ADDRESS || '123 Main St',
    city: process.env.SENDER_CITY || 'Los Angeles',
    state: process.env.SENDER_STATE || 'CA',
    zip: process.env.SENDER_ZIP || '90001'
  },
  unsubscribeUrl: process.env.UNSUBSCRIBE_URL || 'https://yoursurfapp.com/unsubscribe',
  preferencesUrl: process.env.PREFERENCES_URL || 'https://yoursurfapp.com/preferences'
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
    const surfReport = await generateSurfReport(testConfig.location, apiKey);
    
    // Format template data using AI-generated content
    const formattedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const templateData = {
      first_name: testConfig.sender.name.split(' ')[0],
      location: testConfig.location,
      date: formattedDate,
      best_time_to_surf: surfReport.best_time,
      second_best_time: surfReport.second_best,
      short_synopsis: surfReport.swell_summary,
      weather: surfReport.wind_summary,
      gear: surfReport.gear_recommendation,
      stoke_level: surfReport.stoke_level,
      vibe: surfReport.vibe,
      skill_focus: surfReport.skill_focus || CONFIG.DEFAULT_SKILL_FOCUS,
      daily_challenge: surfReport.daily_challenge || CONFIG.DEFAULT_DAILY_CHALLENGE,
      yes_url: CONFIG.CHECKIN_URLS.yes,
      no_url: CONFIG.CHECKIN_URLS.no,
      skipped_url: CONFIG.CHECKIN_URLS.skipped,
      unsubscribe_url: testConfig.unsubscribeUrl,
      preferences_url: testConfig.preferencesUrl,
      sender: {
        name: testConfig.sender.name,
        address: testConfig.sender.address,
        city: testConfig.sender.city,
        state: testConfig.sender.state,
        zip: testConfig.sender.zip
      }
    };

    // Set up SendGrid
    sgMail.setApiKey(sgApiKey);

    // Send email
    await sgMail.send({
      to: testConfig.email,
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