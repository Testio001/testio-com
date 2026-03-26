/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcome } from './welcome.tsx'
import { template as idleReminder } from './idle-reminder.tsx'
import { template as badgeEarned } from './badge-earned.tsx'
import { template as accountDeleted } from './account-deleted.tsx'
import { template as referralSuccess } from './referral-success.tsx'
import { template as creditAlert } from './credit-alert.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcome,
  'idle-reminder': idleReminder,
  'badge-earned': badgeEarned,
  'account-deleted': accountDeleted,
  'referral-success': referralSuccess,
  'credit-alert': creditAlert,
}
