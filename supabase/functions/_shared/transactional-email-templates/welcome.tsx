import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Testio"
const APP_URL = "https://testio.online"

interface WelcomeProps {
  displayName?: string
}

const WelcomeEmail = ({ displayName }: WelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — your study companion</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>{SITE_NAME}</Text>
        <Heading style={h1}>Welcome to {SITE_NAME}! 🎉</Heading>
        <Text style={text}>
          {displayName ? `Hey ${displayName},` : 'Hey there,'} thanks for joining {SITE_NAME}!
        </Text>
        <Text style={text}>
          Upload any lecture note, PDF, or document and we'll turn it into smart study notes, flashcards, quizzes, and even a podcast — all powered by AI.
        </Text>
        <Text style={text}>
          You have <strong>2 free uploads</strong> to get started. Refer friends to earn more!
        </Text>
        <Button style={button} href={`${APP_URL}/dashboard`}>
          Go to Dashboard →
        </Button>
        <Hr style={hr} />
        <Text style={footer}>Happy studying! — The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: `Welcome to ${SITE_NAME}! 🎉`,
  displayName: 'Welcome email',
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
