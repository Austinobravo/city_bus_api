import twilio from "twilio"

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function sendSmsOtp(to: string, otp: string) {
  return client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
    body: `Your verification code is ${otp}. It expires in 10 minutes.`,
  })
}
