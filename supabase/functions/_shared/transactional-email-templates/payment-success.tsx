import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Testio"
const APP_URL = "https://testio.online"

interface PaymentSuccessProps {
  displayName?: string
  planLabel?: string
  isAddon?: boolean
  expiresAt?: string
}

const formatDate = (iso?: string) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return '' }
}

const PaymentSuccessEmail = ({ displayName, planLabel, isAddon, expiresAt }: PaymentSuccessProps) => {
  const plan = planLabel || 'subscription'
  const expires = formatDate(expiresAt)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Payment confirmed — your {plan} is active 🎉</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={logo}>{SITE_NAME}</Text>
          <Heading style={h1}>Congratulations! 🎉</Heading>
          <Text style={text}>
            {displayName ? `Hey ${displayName},` : 'Hey there,'} your payment was successful and your reward has been unlocked.
          </Text>
          <Section style={card}>
            {isAddon ? (
              <>
                <Text style={cardLabel}>Top-up activated</Text>
                <Text style={cardValue}>+5 podcast credits</Text>
              </>
            ) : (
              <>
                <Text style={cardLabel}>Plan activated</Text>
                <Text style={cardValue}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</Text>
                {expires && <Text style={cardSub}>Active until {expires}</Text>}
              </>
            )}
          </Section>
          <Text style={text}>
            Jump back in and start studying smarter — your new perks are ready to use right now.
          </Text>
          <Button style={button} href={`${APP_URL}/dashboard`}>
            Go to Dashboard →
          </Button>
          <Hr style={hr} />
          <Text style={footer}>Thanks for supporting {SITE_NAME}! — The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PaymentSuccessEmail,
  subject: (data: Record<string, any>) =>
    data?.isAddon
      ? `🎉 Payment confirmed — 5 podcast credits added`
      : `🎉 Payment confirmed — your ${data?.planLabel || 'plan'} is active`,
  displayName: 'Payment success',
  previewData: { displayName: 'Jane', planLabel: 'pro', isAddon: false, expiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString() },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 25px' }
const logo = { fontSize: '24px', fontWeight: 'bold' as const, color: '#22c9a0', margin: '0 0 24px' }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const card = { background: '#f5fbf9', border: '1px solid #d6f1e8', borderRadius: '14px', padding: '20px 22px', margin: '8px 0 24px' }
const cardLabel = { fontSize: '12px', color: '#22c9a0', textTransform: 'uppercase' as const, letterSpacing: '0.6px', fontWeight: '600' as const, margin: '0 0 6px' }
const cardValue = { fontSize: '20px', color: '#111111', fontWeight: '700' as const, margin: '0' }
const cardSub = { fontSize: '13px', color: '#55575d', margin: '6px 0 0' }
const button = { display: 'inline-block', background: 'linear-gradient(135deg, #22c9a0, #30d8b0)', color: '#0a0c10', padding: '14px 32px', borderRadius: '999px', textDecoration: 'none', fontWeight: '600' as const, fontSize: '15px' }
const hr = { borderColor: '#e6e6e6', margin: '30px 0' }
const footer = { fontSize: '13px', color: '#999999', margin: '0' }
