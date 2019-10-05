import nodemailer from 'nodemailer'
import Email from 'email-templates'
import mailgun from 'nodemailer-mailgun-transport'

const mailgunSettings = {
  auth: {
    api_key: process.env.MAILGUN_API_KEY,
    domain: 'mg.revolt.club',
  },
  host: 'api.eu.mailgun.net',
}

const transporter = nodemailer.createTransport(mailgun(mailgunSettings))

const emailService = new Email({
  transport: transporter,
  send: process.env.NODE_ENV === 'production',
  preview: true,
  views: {
    root: 'src/emails',
  },
  message: { from: 'campaigns@revolt.club' },
})

export { emailService }
