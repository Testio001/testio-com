import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Testio"
const APP_URL = "https://testio.online"

interface BadgeEarnedProps {
  displayName?: string
  badgeName?: string
}

const BadgeEarnedEmail = ({ displayName, badgeName }: BadgeEarnedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You earned a new badge: {badgeName || 'Achievement'}!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>{SITE_NAME}</Text>
        <Heading style={h1}>Congratulations! 🏆</Heading>
        <Text style={text}>
          {displayName ? `Hey ${displayName},` : 'Hey there,'} you just earned a new badge!
        </Text>
        <Text style={badgeText}>🎖️ {badgeName || 'Achievement Unlocked'}</Text>
        <Text style={text}>
          Keep up the great work — more badges and rewards await as you continue your study streak!
        </Text>
        <Button style={button} href={`${APP_URL}/dashboard`}>
          View My Badges →
        </Button>
        <Hr style={hr} />
        <Text style={footer}>Keep achieving! — The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BadgeEarnedEmail,
  subject: (data: Record<string, any>) => `You earned a new badge: ${data.badgeName || 'Achievement'}! 🏆`,
  displayName: 'Badge earned',
  previewData: { displayName: 'Jane', badgeName: 'The 7-Day Scholar' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 25px' }
const logo = { fontSize: '24px', fontWeight: 'bold' as const, color: '#22c9a0', margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const badgeText = { fontSize: '22px', fontWeight: 'bold' as const, color: '#22c9a0', textAlign: 'center' as const, padding: '20px', backgroundColor: '#f0fdf9', borderRadius: '12px', margin: '0 0 20px' }
const button = { display: 'inline-block', background: 'linear-gradient(135deg, #22c9a0, #30d8b0)', color: '#0a0c10', padding: '14px 32px', borderRadius: '999px', textDecoration: 'none', fontWeight: '600' as const, fontSize: '15px' }
const hr = { borderColor: '#e6e6e6', margin: '30px 0' }
const footer = { fontSize: '13px', color: '#999999', margin: '0' }
