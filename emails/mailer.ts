import nodemailer from 'nodemailer';
import mustache from 'mustache';
import fs from 'fs/promises';
import path from 'path';

async function compileTemplate(templateName: string, data: any) {
  const filePath = path.join(process.cwd(), 'emails', 'templates', `${templateName}.mustache`);
  const templateContent = await fs.readFile(filePath, 'utf8');
  return mustache.render(templateContent, data);
}

export async function sendEmail({
  to,
  subject,
  template,
  data,
}: {
  to: string;
  subject: string;
  template: string;
  data: any;
}) {
  const html = await compileTemplate(template, data);

  const transporter = nodemailer.createTransport({
  host: 'mail.smegear.agency',
  port: 587,
  secure: false, 
  auth: {
    user: 'noreply@smegear.agency',
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false, 
  },
});

  const mailOptions = {
    from: '"SmeGear" <noreply@smegear.agency>',
    to,
    subject,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('✅ Email sent!', info.messageId);
  console.log('✅ Email sent info!', info);
}
