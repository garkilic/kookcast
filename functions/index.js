const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const OpenAI = require('openai');
const functions = require('firebase-functions');

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

    // If location is provided, generate AI report
    if (req.body.location) {
      try {
        console.log(`[AI_REPORT] Generating surf report for ${req.body.location}`);
        const surfReport = await generateSurfReport(req.body.location, openAiKey);
        console.log(`[AI_REPORT] Successfully generated report for ${req.body.location}`);
        
        // Update template data with AI-generated content
        templateData = {
          ...templateData,
          subject: req.body.location + " Surf Report - " + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
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
        console.error(`[AI_ERROR] Failed to generate report for ${req.body.location}:`, error);
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
          const surfReport = await generateSurfReport(location, openAiApiKey);

          // Format template data
          const templateData = {
            subject: location + " Surf Report - " + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            email_header: "🌊 Daily Surf Report",
            forecast_title: `${location} Forecast`,
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

// Function to send signup notification email
async function sendSignupNotification(userEmail) {
  try {
    // Get total number of users
    const usersSnapshot = await admin.firestore().collection('users').get();
    const totalUsers = usersSnapshot.size;

    const msg = {
      to: 'griffin@kook-cast.com',
      from: 'noreply@kook-cast.com',
      subject: `${userEmail} signed up`,
      text: `New user signup!\n\nEmail: ${userEmail}\nTotal users: ${totalUsers}`,
      html: `
        <h2>New User Signup</h2>
        <p><strong>Email:</strong> ${userEmail}</p>
        <p><strong>Total Users:</strong> ${totalUsers}</p>
      `
    };

    await sgMail.send(msg);
    console.log('Signup notification email sent successfully');
  } catch (error) {
    console.error('Error sending signup notification email:', error);
    throw error;
  }
}

// Add to exports
exports.sendSignupNotification = functions.https.onCall(async (data, context) => {
  try {
    const { email } = data;
    if (!email) {
      throw new Error('Email is required');
    }

    await sendSignupNotification(email);
    return { success: true };
  } catch (error) {
    console.error('Error in sendSignupNotification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Test function to send emails immediately
exports.testSendEmails = onRequest({
  cors: true,
  secrets: [sendgridApiKey, sendgridFromEmail, sendgridTemplateId, openaiApiKey],
  memory: "256MiB",
  timeoutSeconds: 540, // Increased to 9 minutes
  minInstances: 1,
  maxInstances: 10
}, async (req, res) => {
  try {
    console.log('[TEST_SEND_EMAILS] Starting immediate email distribution');
    
    // Send immediate response to prevent timeout
    res.json({
      status: 'processing',
      message: 'Email distribution started. Check Firebase logs for progress.'
    });

    // Get all users with emailVerified = true
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('emailVerified', '==', true)
      .get();
    
    // Log all verified users for debugging
    console.log('[TEST_SEND_EMAILS] Verified users:', usersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        email: data.email,
        surfLocations: data.surfLocations,
        emailVerified: data.emailVerified,
        emailVerifiedAt: data.emailVerifiedAt
      };
    }));
    
    console.log(`[TEST_SEND_EMAILS] Found ${usersSnapshot.size} verified users`);

    const sendGridApiKey = sendgridApiKey.value();
    const fromEmail = sendgridFromEmail.value();
    const templateId = sendgridTemplateId.value();
    const openAiApiKey = openaiApiKey.value();

    // Log SendGrid configuration (without sensitive data)
    console.log('[TEST_SEND_EMAILS] SendGrid Configuration:', {
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
      
      console.log(`[TEST_SEND_EMAILS] Processing user ${user.email}:`, {
        hasLocations: surfLocations.length > 0,
        locationCount: surfLocations.length,
        locations: surfLocations
      });
      
      if (surfLocations.length === 0) {
        console.log(`[TEST_SEND_EMAILS] Skipping user ${user.email} - no surf locations set`);
        continue;
      }

      try {
        // Process each surf location for the user
        for (const location of surfLocations) {
          console.log(`[TEST_SEND_EMAILS] Generating report for ${user.email} - Location: ${location}`);
          const surfReport = await generateSurfReport(location, openAiApiKey);

          // Format template data
          const templateData = {
            subject: location + " Surf Report - " + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            email_header: "🌊 Daily Surf Report",
            forecast_title: `${location} Forecast`,
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

          // Log successful email send
          await admin.firestore().collection('emailLogs').add({
            type: 'surf_report',
            timestamp: new Date().toISOString(),
            email: user.email,
            location: location,
            status: 'success',
            source: 'test_send'
          });

          console.log(`[TEST_SEND_EMAILS] Successfully sent report to ${user.email} for location ${location}`);
          processedEmails.push(user.email);
        }
        successCount++;
      } catch (error) {
        console.error(`[TEST_SEND_EMAILS] Failed to process user ${user.email}:`, error);
        
        // Log failed email attempt
        await admin.firestore().collection('emailLogs').add({
          type: 'surf_report',
          timestamp: new Date().toISOString(),
          email: user.email,
          status: 'error',
          error: error.message,
          source: 'test_send'
        });
        
        errorCount++;
      }
    }

    console.log('[TEST_SEND_EMAILS] Complete', {
      total_users: usersSnapshot.size,
      success_count: successCount,
      error_count: errorCount,
      processed_emails: processedEmails,
      timestamp: new Date().toISOString()
    });

    // Log summary to Firestore
    await admin.firestore().collection('emailLogs').add({
      type: 'test_send_summary',
      timestamp: new Date().toISOString(),
      stats: {
        total_users: usersSnapshot.size,
        success_count: successCount,
        error_count: errorCount,
        processed_emails: processedEmails
      }
    });

  } catch (error) {
    console.error('[TEST_SEND_EMAILS] Error:', error);
    // Log error to Firestore
    await admin.firestore().collection('emailLogs').add({
      type: 'test_send_error',
      timestamp: new Date().toISOString(),
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