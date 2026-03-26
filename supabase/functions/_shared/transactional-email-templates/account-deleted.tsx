import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Testio"

const AccountDeletedEmail = () => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} account has been deleted</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>{SITE_NAME}</Text>
        <Heading style={h1}>Account Deleted</Heading>
        <Text style={text}>
          Your account and all associated data have been permanently deleted as requested.
        </Text>
        <Text style={text}>
          This includes your documents, notes, flashcards, quizzes, and any other data stored in your account.
        </Text>
        <Text style={text}>
          If this wasn't you, please contact us immediately at <strong>Testio4171@gmail.com</strong>.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>We're sorry to see you go. — The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AccountDeletedEmail,
  subject: `Your ${SITE_NAME} account has been deleted`,
  displayName: 'Account deleted',
  previewData: {},
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 25px' }
const logo = { fontSize: '24px', fontWeight: 'bold' as const, color: '#22c9a0', margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#111111', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const hr = { borderColor: '#e6e6e6', margin: '30px 0' }
const footer = { fontSize: '13px', color: '#999999', margin: '0' }
