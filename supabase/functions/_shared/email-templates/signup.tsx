/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token?: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  token,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>{siteName}</Text>
        <Heading style={h1}>Confirm your email</Heading>
        <Text style={text}>
          Thanks for signing up for{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>!
        </Text>
        <Text style={text}>
          Enter this 6-digit code in the app to verify your email address (
          <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>
          ):
        </Text>
        <Text style={codeStyle}>{token ?? 'Request a new code in the app'}</Text>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const logo = { fontSize: '24px', fontWeight: 'bold' as const, color: '#22c9a0', margin: '0 0 20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: '#22c9a0', textDecoration: 'underline' }
const codeStyle = { fontFamily: "'Space Grotesk', Courier, monospace", fontSize: '28px', fontWeight: 'bold' as const, color: '#22c9a0', letterSpacing: '4px', margin: '0 0 30px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
