import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Testio"
const APP_URL = "https://testio.online"

interface IdleReminderProps {
  displayName?: string
}

const IdleReminderEmail = ({ displayName }: IdleReminderProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>It's been 3 days — don't let your notes pile up!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>{SITE_NAME}</Text>
        <Heading style={h1}>We miss you! 📚</Heading>
        <Text style={text}>
          {displayName ? `Hey ${displayName},` : 'Hey there,'} it's been 3 days since your last upload.
        </Text>
        <Text style={text}>
          Don't let your notes pile up — upload your latest lecture now and keep your study materials organized!
        </Text>
        <Button style={button} href={`${APP_URL}/dashboard`}>
          Upload Now →
        </Button>
        <Hr style={hr} />
        <Text style={footer}>Keep learning! — The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: IdleReminderEmail,
  subject: "It's been 3 days — don't let your notes pile up! 📚",
  displayName: 'Idle reminder',
  previewData: { displayName: 'Jane' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 25px' }
const logo = { fontSize: '24px', fontWeight: 'bold' as const, color: '#22c9a0', margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const button = { display: 'inline-block', background: 'linear-gradient(135deg, #22c9a0, #30d8b0)', color: '#0a0c10', padding: '14px 32px', borderRadius: '999px', textDecoration: 'none', fontWeight: '600' as const, fontSize: '15px' }
const hr = { borderColor: '#e6e6e6', margin: '30px 0' }
const footer = { fontSize: '13px', color: '#999999', margin: '0' }
