const sgMail = require('@sendgrid/mail');

// Set your API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'griffin@kook-cast.com', // Your verified sender email
  from: 'griffin@kook-cast.com', // Your verified sender email
  subject: 'SendGrid Test',
  text: 'This is a test email from SendGrid',
  html: '<strong>This is a test email from SendGrid</strong>',
};

sgMail
  .send(msg)
  .then(() => {
    console.log('Test email sent successfully');
  })
  .catch((error) => {
    console.error('Error sending test email:', error);
    if (error.response) {
      console.error(error.response.body);
    }
  }); 