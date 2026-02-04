/**
 * Supabase Database Types
 * Auto-generated based on migration files (001-022)
 * Last updated: 2026-01-31
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─────────────────────────────────────────────────────────
// ENUM Types
// ─────────────────────────────────────────────────────────

export type PlanType = 'starter' | 'pro' | 'team' | 'enterprise'
export type BillingCycle = 'monthly' | 'yearly'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused'
export type PaymentType = 'subscription' | 'credit_purchase' | 'plan_change'
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'canceled' | 'refunded' | 'partial_refunded'
export type CreditTransactionType = 'purchase' | 'subscription_grant' | 'usage' | 'refund' | 'expiry' | 'admin_adjustment'
export type TeamRole = 'owner' | 'admin' | 'member'
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'
export type InvitationRole = 'admin' | 'member'
export type UserRole = 'user' | 'admin' | 'super_admin'
export type Language = 'python' | 'javascript' | 'sql' | 'java' | 'typescript' | 'go'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type TargetAudience = 'non_tech' | 'junior_dev' | 'manager' | 'career_changer'

// Type aliases for schema validation compatibility
export type DifficultyLevelDb = Difficulty
export type TargetAudienceDb = TargetAudience
export type LearningStatus = 'not_started' | 'in_progress' | 'completed' | 'revisiting'
export type AchievementCategory = 'streak' | 'completion' | 'time' | 'language' | 'quiz' | 'social'
export type FeedbackReportReason = 'spam' | 'inappropriate' | 'misleading' | 'harassment' | 'other'
export type FeedbackReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed'

// Refund Request ENUMs (from 014_refund_request_tracking.sql)
export type RefundType = 'full' | 'partial' | 'prorated'
export type RefundRequestStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'rejected' | 'canceled'

// Webhook Log ENUMs (from 006, 010)
export type WebhookLogStatus = 'pending' | 'processed' | 'failed' | 'retrying'

// Notification ENUMs (from 022_notifications.sql)
export type NotificationType =
  | 'payment_success'
  | 'payment_failed'
  | 'subscription_started'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'subscription_expiring'
  | 'credits_low'
  | 'credits_added'
  | 'content_generated'
  | 'content_failed'
  | 'achievement_unlocked'
  | 'streak_reminder'
  | 'streak_broken'
  | 'level_up'
  | 'system_announcement'
  | 'maintenance'
  | 'feature_update'
  | 'welcome'
  | 'feedback_response'

export type NotificationCategory = 'payment' | 'subscription' | 'content' | 'learning' | 'system'
export type NotificationChannel = 'in_app' | 'email' | 'push'
export type EmailFrequency = 'instant' | 'daily' | 'weekly' | 'never'
export type DigestType = 'daily' | 'weekly'

// ─────────────────────────────────────────────────────────
// Database Interface
// ─────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      // ─────────────────────────────────────────────────────────
      // profiles (001, 003, 004, 015)
      // ─────────────────────────────────────────────────────────
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          plan: PlanType
          daily_generations_remaining: number
          daily_reset_at: string | null
          credits_balance: number
          plan_expires_at: string | null
          customer_key: string
          team_id: string | null
          team_role: TeamRole | null
          role: UserRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          plan?: PlanType
          daily_generations_remaining?: number
          daily_reset_at?: string | null
          credits_balance?: number
          plan_expires_at?: string | null
          customer_key?: string
          team_id?: string | null
          team_role?: TeamRole | null
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          plan?: PlanType
          daily_generations_remaining?: number
          daily_reset_at?: string | null
          credits_balance?: number
          plan_expires_at?: string | null
          customer_key?: string
          team_id?: string | null
          team_role?: TeamRole | null
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_profiles_team_id'
            columns: ['team_id']
            referencedRelation: 'teams'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // generated_contents (002, 005)
      // ─────────────────────────────────────────────────────────
      generated_contents: {
        Row: {
          id: string
          user_id: string
          language: Language
          topic: string
          difficulty: Difficulty
          target_audience: TargetAudience
          title: string | null
          content: string
          code_examples: Json | null
          quiz: Json | null
          model_used: string | null
          tokens_used: number | null
          generation_time_ms: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          language: Language
          topic: string
          difficulty: Difficulty
          target_audience: TargetAudience
          title?: string | null
          content: string
          code_examples?: Json | null
          quiz?: Json | null
          model_used?: string | null
          tokens_used?: number | null
          generation_time_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          language?: Language
          topic?: string
          difficulty?: Difficulty
          target_audience?: TargetAudience
          title?: string | null
          content?: string
          code_examples?: Json | null
          quiz?: Json | null
          model_used?: string | null
          tokens_used?: number | null
          generation_time_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'generated_contents_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // subscriptions (003)
      // ─────────────────────────────────────────────────────────
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan: Exclude<PlanType, 'starter'>
          billing_cycle: BillingCycle
          status: SubscriptionStatus
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          canceled_at: string | null
          billing_key_id: string | null
          scheduled_plan: string | null
          scheduled_billing_cycle: string | null
          scheduled_change_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan: Exclude<PlanType, 'starter'>
          billing_cycle: BillingCycle
          status?: SubscriptionStatus
          current_period_start: string
          current_period_end: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          billing_key_id?: string | null
          scheduled_plan?: string | null
          scheduled_billing_cycle?: string | null
          scheduled_change_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan?: Exclude<PlanType, 'starter'>
          billing_cycle?: BillingCycle
          status?: SubscriptionStatus
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          billing_key_id?: string | null
          scheduled_plan?: string | null
          scheduled_billing_cycle?: string | null
          scheduled_change_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_subscriptions_billing_key_id'
            columns: ['billing_key_id']
            referencedRelation: 'billing_keys'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // payments (003, 007)
      // ─────────────────────────────────────────────────────────
      payments: {
        Row: {
          id: string
          user_id: string
          order_id: string
          payment_key: string | null
          type: PaymentType
          status: PaymentStatus
          amount: number
          method: string | null
          receipt_url: string | null
          metadata: Json
          failure_code: string | null
          failure_reason: string | null
          refund_amount: number | null
          refund_reason: string | null
          refunded_at: string | null
          subscription_id: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          order_id: string
          payment_key?: string | null
          type: PaymentType
          status?: PaymentStatus
          amount: number
          method?: string | null
          receipt_url?: string | null
          metadata?: Json
          failure_code?: string | null
          failure_reason?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          subscription_id?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          order_id?: string
          payment_key?: string | null
          type?: PaymentType
          status?: PaymentStatus
          amount?: number
          method?: string | null
          receipt_url?: string | null
          metadata?: Json
          failure_code?: string | null
          failure_reason?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          subscription_id?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payments_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_subscription_id_fkey'
            columns: ['subscription_id']
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // refund_requests (014)
      // ─────────────────────────────────────────────────────────
      refund_requests: {
        Row: {
          id: string
          payment_id: string
          user_id: string
          requested_amount: number
          approved_amount: number | null
          refund_type: RefundType
          status: RefundRequestStatus
          reason: string
          admin_note: string | null
          rejection_reason: string | null
          processed_by: string | null
          processed_at: string | null
          retry_count: number
          max_retries: number
          last_retry_at: string | null
          next_retry_at: string | null
          last_error: string | null
          original_credits: number | null
          used_credits: number | null
          refundable_credits: number | null
          proration_details: Json | null
          toss_response: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          payment_id: string
          user_id: string
          requested_amount: number
          approved_amount?: number | null
          refund_type?: RefundType
          status?: RefundRequestStatus
          reason: string
          admin_note?: string | null
          rejection_reason?: string | null
          processed_by?: string | null
          processed_at?: string | null
          retry_count?: number
          max_retries?: number
          last_retry_at?: string | null
          next_retry_at?: string | null
          last_error?: string | null
          original_credits?: number | null
          used_credits?: number | null
          refundable_credits?: number | null
          proration_details?: Json | null
          toss_response?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          payment_id?: string
          user_id?: string
          requested_amount?: number
          approved_amount?: number | null
          refund_type?: RefundType
          status?: RefundRequestStatus
          reason?: string
          admin_note?: string | null
          rejection_reason?: string | null
          processed_by?: string | null
          processed_at?: string | null
          retry_count?: number
          max_retries?: number
          last_retry_at?: string | null
          next_retry_at?: string | null
          last_error?: string | null
          original_credits?: number | null
          used_credits?: number | null
          refundable_credits?: number | null
          proration_details?: Json | null
          toss_response?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'refund_requests_payment_id_fkey'
            columns: ['payment_id']
            referencedRelation: 'payments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'refund_requests_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'refund_requests_processed_by_fkey'
            columns: ['processed_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // billing_keys (003)
      // ─────────────────────────────────────────────────────────
      billing_keys: {
        Row: {
          id: string
          user_id: string
          customer_key: string
          encrypted_billing_key: string
          card_company: string
          card_number: string
          card_type: string | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_key: string
          encrypted_billing_key: string
          card_company: string
          card_number: string
          card_type?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_key?: string
          encrypted_billing_key?: string
          card_company?: string
          card_number?: string
          card_type?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'billing_keys_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // credit_transactions (003)
      // ─────────────────────────────────────────────────────────
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          type: CreditTransactionType
          amount: number
          balance: number
          description: string | null
          payment_id: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: CreditTransactionType
          amount: number
          balance: number
          description?: string | null
          payment_id?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: CreditTransactionType
          amount?: number
          balance?: number
          description?: string | null
          payment_id?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'credit_transactions_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'credit_transactions_payment_id_fkey'
            columns: ['payment_id']
            referencedRelation: 'payments'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // webhook_logs (003, 010)
      // ─────────────────────────────────────────────────────────
      webhook_logs: {
        Row: {
          id: string
          event_type: string
          payload: Json
          idempotency_key: string | null
          status: WebhookLogStatus
          processed_at: string | null
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          payload: Json
          idempotency_key?: string | null
          status?: WebhookLogStatus
          processed_at?: string | null
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          payload?: Json
          idempotency_key?: string | null
          status?: WebhookLogStatus
          processed_at?: string | null
          error?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // ─────────────────────────────────────────────────────────
      // teams (004)
      // ─────────────────────────────────────────────────────────
      teams: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          owner_id: string
          max_members: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          owner_id: string
          max_members?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          owner_id?: string
          max_members?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'teams_owner_id_fkey'
            columns: ['owner_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // team_members (004)
      // ─────────────────────────────────────────────────────────
      team_members: {
        Row: {
          id: string
          team_id: string
          user_id: string
          role: TeamRole
          invited_by: string | null
          joined_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          role?: TeamRole
          invited_by?: string | null
          joined_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          role?: TeamRole
          invited_by?: string | null
          joined_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'team_members_team_id_fkey'
            columns: ['team_id']
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'team_members_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'team_members_invited_by_fkey'
            columns: ['invited_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // team_invitations (004)
      // ─────────────────────────────────────────────────────────
      team_invitations: {
        Row: {
          id: string
          team_id: string
          email: string
          role: InvitationRole
          token: string
          status: InvitationStatus
          invited_by: string
          expires_at: string
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          email: string
          role?: InvitationRole
          token?: string
          status?: InvitationStatus
          invited_by: string
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          email?: string
          role?: InvitationRole
          token?: string
          status?: InvitationStatus
          invited_by?: string
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'team_invitations_team_id_fkey'
            columns: ['team_id']
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'team_invitations_invited_by_fkey'
            columns: ['invited_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'team_invitations_accepted_by_fkey'
            columns: ['accepted_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // team_api_keys (004)
      // ─────────────────────────────────────────────────────────
      team_api_keys: {
        Row: {
          id: string
          team_id: string
          name: string
          key_prefix: string
          key_hash: string
          permissions: Json
          rate_limit_per_minute: number
          daily_limit: number
          total_requests: number
          last_used_at: string | null
          is_active: boolean
          created_by: string
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          name: string
          key_prefix: string
          key_hash: string
          permissions?: Json
          rate_limit_per_minute?: number
          daily_limit?: number
          total_requests?: number
          last_used_at?: string | null
          is_active?: boolean
          created_by: string
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          name?: string
          key_prefix?: string
          key_hash?: string
          permissions?: Json
          rate_limit_per_minute?: number
          daily_limit?: number
          total_requests?: number
          last_used_at?: string | null
          is_active?: boolean
          created_by?: string
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'team_api_keys_team_id_fkey'
            columns: ['team_id']
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'team_api_keys_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // team_api_usage (004)
      // ─────────────────────────────────────────────────────────
      team_api_usage: {
        Row: {
          id: string
          team_id: string
          api_key_id: string
          endpoint: string
          method: string
          status_code: number | null
          response_time_ms: number | null
          metadata: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          api_key_id: string
          endpoint: string
          method: string
          status_code?: number | null
          response_time_ms?: number | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          api_key_id?: string
          endpoint?: string
          method?: string
          status_code?: number | null
          response_time_ms?: number | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'team_api_usage_team_id_fkey'
            columns: ['team_id']
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'team_api_usage_api_key_id_fkey'
            columns: ['api_key_id']
            referencedRelation: 'team_api_keys'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // learner_profiles (016)
      // ─────────────────────────────────────────────────────────
      learner_profiles: {
        Row: {
          id: string
          user_id: string
          experience_level: Difficulty | null
          learning_goals: string[]
          preferred_languages: string[]
          weekly_time_commitment: number
          age: number | null
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          experience_level?: Difficulty | null
          learning_goals?: string[]
          preferred_languages?: string[]
          weekly_time_commitment?: number
          age?: number | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          experience_level?: Difficulty | null
          learning_goals?: string[]
          preferred_languages?: string[]
          weekly_time_commitment?: number
          age?: number | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'learner_profiles_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // level_tests (016)
      // ─────────────────────────────────────────────────────────
      level_tests: {
        Row: {
          id: string
          user_id: string
          language: Language
          score: number
          total_questions: number
          determined_level: Difficulty
          time_taken_seconds: number | null
          answers: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          language: Language
          score: number
          total_questions: number
          determined_level: Difficulty
          time_taken_seconds?: number | null
          answers?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          language?: Language
          score?: number
          total_questions?: number
          determined_level?: Difficulty
          time_taken_seconds?: number | null
          answers?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'level_tests_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // level_test_questions (016)
      // ─────────────────────────────────────────────────────────
      level_test_questions: {
        Row: {
          id: string
          language: Language
          difficulty: Difficulty
          question: string
          code_snippet: string | null
          options: Json
          correct_answer: string
          explanation: string | null
          topic: string
          order_index: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          language: Language
          difficulty: Difficulty
          question: string
          code_snippet?: string | null
          options: Json
          correct_answer: string
          explanation?: string | null
          topic: string
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          language?: Language
          difficulty?: Difficulty
          question?: string
          code_snippet?: string | null
          options?: Json
          correct_answer?: string
          explanation?: string | null
          topic?: string
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // ─────────────────────────────────────────────────────────
      // bookmark_folders (017)
      // ─────────────────────────────────────────────────────────
      bookmark_folders: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          color: string
          icon: string
          parent_id: string | null
          order_index: number
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          color?: string
          icon?: string
          parent_id?: string | null
          order_index?: number
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          color?: string
          icon?: string
          parent_id?: string | null
          order_index?: number
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bookmark_folders_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookmark_folders_parent_id_fkey'
            columns: ['parent_id']
            referencedRelation: 'bookmark_folders'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // content_bookmarks (017)
      // ─────────────────────────────────────────────────────────
      content_bookmarks: {
        Row: {
          id: string
          user_id: string
          content_id: string
          folder_id: string | null
          note: string | null
          tags: string[]
          is_favorite: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content_id: string
          folder_id?: string | null
          note?: string | null
          tags?: string[]
          is_favorite?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content_id?: string
          folder_id?: string | null
          note?: string | null
          tags?: string[]
          is_favorite?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'content_bookmarks_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_bookmarks_content_id_fkey'
            columns: ['content_id']
            referencedRelation: 'generated_contents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_bookmarks_folder_id_fkey'
            columns: ['folder_id']
            referencedRelation: 'bookmark_folders'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // content_ratings (018)
      // ─────────────────────────────────────────────────────────
      content_ratings: {
        Row: {
          id: string
          user_id: string
          content_id: string
          rating: number
          accuracy_score: number | null
          clarity_score: number | null
          code_quality_score: number | null
          difficulty_match_score: number | null
          feedback_text: string | null
          was_helpful: boolean | null
          would_recommend: boolean | null
          improvement_requests: string[]
          feedback_source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content_id: string
          rating: number
          accuracy_score?: number | null
          clarity_score?: number | null
          code_quality_score?: number | null
          difficulty_match_score?: number | null
          feedback_text?: string | null
          was_helpful?: boolean | null
          would_recommend?: boolean | null
          improvement_requests?: string[]
          feedback_source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content_id?: string
          rating?: number
          accuracy_score?: number | null
          clarity_score?: number | null
          code_quality_score?: number | null
          difficulty_match_score?: number | null
          feedback_text?: string | null
          was_helpful?: boolean | null
          would_recommend?: boolean | null
          improvement_requests?: string[]
          feedback_source?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'content_ratings_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_ratings_content_id_fkey'
            columns: ['content_id']
            referencedRelation: 'generated_contents'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // feedback_responses (018)
      // ─────────────────────────────────────────────────────────
      feedback_responses: {
        Row: {
          id: string
          rating_id: string
          responder_id: string | null
          response_text: string
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rating_id: string
          responder_id?: string | null
          response_text: string
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rating_id?: string
          responder_id?: string | null
          response_text?: string
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'feedback_responses_rating_id_fkey'
            columns: ['rating_id']
            referencedRelation: 'content_ratings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'feedback_responses_responder_id_fkey'
            columns: ['responder_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // feedback_reports (018)
      // ─────────────────────────────────────────────────────────
      feedback_reports: {
        Row: {
          id: string
          rating_id: string
          reporter_id: string | null
          reason: FeedbackReportReason
          description: string | null
          status: FeedbackReportStatus
          reviewed_by: string | null
          reviewed_at: string | null
          resolution_note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          rating_id: string
          reporter_id?: string | null
          reason: FeedbackReportReason
          description?: string | null
          status?: FeedbackReportStatus
          reviewed_by?: string | null
          reviewed_at?: string | null
          resolution_note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          rating_id?: string
          reporter_id?: string | null
          reason?: FeedbackReportReason
          description?: string | null
          status?: FeedbackReportStatus
          reviewed_by?: string | null
          reviewed_at?: string | null
          resolution_note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'feedback_reports_rating_id_fkey'
            columns: ['rating_id']
            referencedRelation: 'content_ratings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'feedback_reports_reporter_id_fkey'
            columns: ['reporter_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'feedback_reports_reviewed_by_fkey'
            columns: ['reviewed_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // learning_progress (019)
      // ─────────────────────────────────────────────────────────
      learning_progress: {
        Row: {
          id: string
          user_id: string
          content_id: string
          status: LearningStatus
          progress_percentage: number
          started_at: string | null
          completed_at: string | null
          last_accessed_at: string
          time_spent_seconds: number
          session_count: number
          quiz_score: number | null
          quiz_attempts: number
          exercises_completed: number
          exercises_total: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content_id: string
          status?: LearningStatus
          progress_percentage?: number
          started_at?: string | null
          completed_at?: string | null
          last_accessed_at?: string
          time_spent_seconds?: number
          session_count?: number
          quiz_score?: number | null
          quiz_attempts?: number
          exercises_completed?: number
          exercises_total?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content_id?: string
          status?: LearningStatus
          progress_percentage?: number
          started_at?: string | null
          completed_at?: string | null
          last_accessed_at?: string
          time_spent_seconds?: number
          session_count?: number
          quiz_score?: number | null
          quiz_attempts?: number
          exercises_completed?: number
          exercises_total?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'learning_progress_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_progress_content_id_fkey'
            columns: ['content_id']
            referencedRelation: 'generated_contents'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // learning_streaks (019)
      // ─────────────────────────────────────────────────────────
      learning_streaks: {
        Row: {
          id: string
          user_id: string
          current_streak: number
          longest_streak: number
          streak_start_date: string | null
          last_activity_date: string | null
          weekly_goal_days: number
          weekly_completed_days: number
          total_learning_days: number
          total_contents_completed: number
          total_time_spent_seconds: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          current_streak?: number
          longest_streak?: number
          streak_start_date?: string | null
          last_activity_date?: string | null
          weekly_goal_days?: number
          weekly_completed_days?: number
          total_learning_days?: number
          total_contents_completed?: number
          total_time_spent_seconds?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          current_streak?: number
          longest_streak?: number
          streak_start_date?: string | null
          last_activity_date?: string | null
          weekly_goal_days?: number
          weekly_completed_days?: number
          total_learning_days?: number
          total_contents_completed?: number
          total_time_spent_seconds?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'learning_streaks_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // daily_learning_logs (019)
      // ─────────────────────────────────────────────────────────
      daily_learning_logs: {
        Row: {
          id: string
          user_id: string
          log_date: string
          contents_started: number
          contents_completed: number
          time_spent_seconds: number
          sessions_count: number
          content_ids: string[]
          time_by_language: Json
          daily_goal_met: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          log_date?: string
          contents_started?: number
          contents_completed?: number
          time_spent_seconds?: number
          sessions_count?: number
          content_ids?: string[]
          time_by_language?: Json
          daily_goal_met?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          log_date?: string
          contents_started?: number
          contents_completed?: number
          time_spent_seconds?: number
          sessions_count?: number
          content_ids?: string[]
          time_by_language?: Json
          daily_goal_met?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'daily_learning_logs_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // achievements (019)
      // ─────────────────────────────────────────────────────────
      achievements: {
        Row: {
          id: string
          user_id: string
          achievement_type: string
          achievement_level: number
          achieved_at: string
          achievement_value: number | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          achievement_type: string
          achievement_level?: number
          achieved_at?: string
          achievement_value?: number | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          achievement_type?: string
          achievement_level?: number
          achieved_at?: string
          achievement_value?: number | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'achievements_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // achievement_definitions (019)
      // ─────────────────────────────────────────────────────────
      achievement_definitions: {
        Row: {
          id: string
          name: string
          description: string
          icon: string
          category: AchievementCategory
          levels: Json
          points_per_level: number
          is_active: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          description: string
          icon?: string
          category: AchievementCategory
          levels?: Json
          points_per_level?: number
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          icon?: string
          category?: AchievementCategory
          levels?: Json
          points_per_level?: number
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // ─────────────────────────────────────────────────────────
      // notifications (022)
      // ─────────────────────────────────────────────────────────
      notifications: {
        Row: {
          id: string
          user_id: string
          type: NotificationType
          category: NotificationCategory
          title: string
          message: string
          metadata: Json
          action_url: string | null
          action_label: string | null
          is_read: boolean
          read_at: string | null
          email_sent: boolean
          email_sent_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: NotificationType
          category: NotificationCategory
          title: string
          message: string
          metadata?: Json
          action_url?: string | null
          action_label?: string | null
          is_read?: boolean
          read_at?: string | null
          email_sent?: boolean
          email_sent_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: NotificationType
          category?: NotificationCategory
          title?: string
          message?: string
          metadata?: Json
          action_url?: string | null
          action_label?: string | null
          is_read?: boolean
          read_at?: string | null
          email_sent?: boolean
          email_sent_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // notification_settings (022)
      // ─────────────────────────────────────────────────────────
      notification_settings: {
        Row: {
          id: string
          user_id: string
          category: NotificationCategory
          in_app_enabled: boolean
          email_enabled: boolean
          push_enabled: boolean
          email_frequency: EmailFrequency
          quiet_hours_start: string | null
          quiet_hours_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category: NotificationCategory
          in_app_enabled?: boolean
          email_enabled?: boolean
          push_enabled?: boolean
          email_frequency?: EmailFrequency
          quiet_hours_start?: string | null
          quiet_hours_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category?: NotificationCategory
          in_app_enabled?: boolean
          email_enabled?: boolean
          push_enabled?: boolean
          email_frequency?: EmailFrequency
          quiet_hours_start?: string | null
          quiet_hours_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_settings_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }

      // ─────────────────────────────────────────────────────────
      // email_digest_queue (022)
      // ─────────────────────────────────────────────────────────
      email_digest_queue: {
        Row: {
          id: string
          user_id: string
          notification_id: string
          digest_type: DigestType
          scheduled_at: string
          sent: boolean
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          notification_id: string
          digest_type: DigestType
          scheduled_at: string
          sent?: boolean
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notification_id?: string
          digest_type?: DigestType
          scheduled_at?: string
          sent?: boolean
          sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'email_digest_queue_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'email_digest_queue_notification_id_fkey'
            columns: ['notification_id']
            referencedRelation: 'notifications'
            referencedColumns: ['id']
          }
        ]
      }
    }

    // ─────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────
    Views: {
      payment_stats: {
        Row: {
          user_id: string
          total_payments: number
          total_amount: number
          total_refunds: number
          last_payment_at: string | null
        }
        Relationships: []
      }
      generation_stats: {
        Row: {
          user_id: string
          total_generations: number
          today_generations: number
          week_generations: number
          used_languages: string[]
          last_generation_at: string | null
        }
        Relationships: []
      }
      notification_stats: {
        Row: {
          user_id: string
          total_notifications: number
          unread_count: number
          read_count: number
          last_24h_count: number
          last_7d_count: number
          last_notification_at: string | null
          last_read_at: string | null
        }
        Relationships: []
      }
      bookmark_stats: {
        Row: {
          user_id: string
          total_bookmarks: number
          favorite_count: number
          folders_used: number
          unique_tags: number
          last_bookmarked_at: string | null
        }
        Relationships: []
      }
      rating_dashboard_stats: {
        Row: {
          total_ratings: number
          overall_average: number
          positive_ratings: number
          negative_ratings: number
          ratings_with_feedback: number
          unique_raters: number
          rated_contents: number
          last_rating_at: string | null
        }
        Relationships: []
      }
      rating_stats_by_language: {
        Row: {
          language: Language
          total_ratings: number
          average_rating: number
          avg_accuracy: number
          avg_clarity: number
          avg_code_quality: number
          helpful_count: number
        }
        Relationships: []
      }
      learning_leaderboard: {
        Row: {
          user_id: string
          user_name: string | null
          current_streak: number
          longest_streak: number
          total_contents_completed: number
          total_learning_days: number
          total_time_spent_seconds: number
          achievement_count: number
        }
        Relationships: []
      }
    }

    // ─────────────────────────────────────────────────────────
    // Functions (RPC)
    // ─────────────────────────────────────────────────────────
    Functions: {
      // Credit Functions (011)
      use_credit_atomic: {
        Args: {
          p_user_id: string
          p_amount: number
          p_description: string
        }
        Returns: {
          success: boolean
          new_balance: number
          error_message: string | null
        }[]
      }
      add_credit_atomic: {
        Args: {
          p_user_id: string
          p_amount: number
          p_type: string
          p_description: string
          p_payment_id?: string | null
          p_expires_at?: string | null
        }
        Returns: {
          success: boolean
          new_balance: number
          error_message: string | null
        }[]
      }

      // Notification Functions (022)
      create_notification: {
        Args: {
          p_user_id: string
          p_type: NotificationType
          p_title: string
          p_message: string
          p_metadata?: Json
          p_action_url?: string | null
          p_action_label?: string | null
          p_expires_in_days?: number | null
        }
        Returns: {
          success: boolean
          notification_id: string | null
          should_send_email: boolean
          error_message: string | null
        }[]
      }
      mark_notification_read: {
        Args: {
          p_notification_id: string
          p_user_id: string
        }
        Returns: {
          success: boolean
          error_message: string | null
        }[]
      }
      mark_all_notifications_read: {
        Args: {
          p_user_id: string
          p_category?: NotificationCategory | null
        }
        Returns: {
          success: boolean
          updated_count: number
          error_message: string | null
        }[]
      }
      get_unread_notification_count: {
        Args: {
          p_user_id: string
        }
        Returns: {
          total_unread: number
          payment_unread: number
          subscription_unread: number
          content_unread: number
          learning_unread: number
          system_unread: number
        }[]
      }
      get_notifications: {
        Args: {
          p_user_id: string
          p_category?: NotificationCategory | null
          p_unread_only?: boolean
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          id: string
          type: NotificationType
          category: NotificationCategory
          title: string
          message: string
          metadata: Json
          action_url: string | null
          action_label: string | null
          is_read: boolean
          read_at: string | null
          created_at: string
        }[]
      }
      update_notification_settings: {
        Args: {
          p_user_id: string
          p_category: NotificationCategory
          p_in_app_enabled?: boolean | null
          p_email_enabled?: boolean | null
          p_email_frequency?: string | null
          p_quiet_hours_start?: string | null
          p_quiet_hours_end?: string | null
        }
        Returns: {
          success: boolean
          error_message: string | null
        }[]
      }
      get_notification_settings: {
        Args: {
          p_user_id: string
        }
        Returns: {
          category: NotificationCategory
          in_app_enabled: boolean
          email_enabled: boolean
          push_enabled: boolean
          email_frequency: string
          quiet_hours_start: string | null
          quiet_hours_end: string | null
        }[]
      }
      cleanup_old_notifications: {
        Args: {
          p_read_days_old?: number
          p_unread_days_old?: number
        }
        Returns: {
          deleted_count: number
        }[]
      }

      // Level Test Functions (016)
      submit_level_test: {
        Args: {
          p_user_id: string
          p_language: string
          p_answers: Json
          p_time_taken_seconds?: number | null
        }
        Returns: {
          test_id: string
          score: number
          total_questions: number
          determined_level: string
          percentage: number
        }[]
      }
      determine_level: {
        Args: {
          p_score: number
          p_total_questions: number
        }
        Returns: string
      }
      get_level_test_questions: {
        Args: {
          p_language: string
          p_questions_per_level?: number
        }
        Returns: {
          id: string
          difficulty: string
          question: string
          code_snippet: string | null
          options: Json
          topic: string
          order_index: number
        }[]
      }
      get_user_level_by_language: {
        Args: {
          p_user_id: string
          p_language: string
        }
        Returns: {
          determined_level: string
          score: number
          total_questions: number
          tested_at: string
        }[]
      }
      complete_onboarding: {
        Args: {
          p_user_id: string
          p_experience_level: string
          p_learning_goals: string[]
          p_preferred_languages: string[]
          p_weekly_time_commitment?: number
          p_age?: number | null
        }
        Returns: {
          success: boolean
          profile_id: string | null
          error_message: string | null
        }[]
      }

      update_learner_age: {
        Args: {
          p_user_id: string
          p_age: number
        }
        Returns: {
          success: boolean
          error_message: string | null
        }[]
      }

      // Bookmark Functions (017)
      toggle_bookmark: {
        Args: {
          p_user_id: string
          p_content_id: string
          p_folder_id?: string | null
        }
        Returns: {
          success: boolean
          action: string
          bookmark_id: string | null
          error_message: string | null
        }[]
      }
      move_bookmark_to_folder: {
        Args: {
          p_bookmark_id: string
          p_user_id: string
          p_new_folder_id: string
        }
        Returns: {
          success: boolean
          error_message: string | null
        }[]
      }
      get_bookmark_folder_stats: {
        Args: {
          p_user_id: string
        }
        Returns: {
          folder_id: string
          folder_name: string
          bookmark_count: number
          favorite_count: number
        }[]
      }
      search_bookmarks: {
        Args: {
          p_user_id: string
          p_query?: string | null
          p_folder_id?: string | null
          p_tags?: string[] | null
          p_favorites_only?: boolean
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          bookmark_id: string
          content_id: string
          content_title: string | null
          content_language: string | null
          content_topic: string | null
          folder_id: string | null
          folder_name: string | null
          note: string | null
          tags: string[]
          is_favorite: boolean
          bookmarked_at: string
        }[]
      }

      // Rating Functions (018)
      upsert_content_rating: {
        Args: {
          p_user_id: string
          p_content_id: string
          p_rating: number
          p_accuracy_score?: number | null
          p_clarity_score?: number | null
          p_code_quality_score?: number | null
          p_difficulty_match_score?: number | null
          p_feedback_text?: string | null
          p_was_helpful?: boolean | null
          p_would_recommend?: boolean | null
          p_improvement_requests?: string[]
        }
        Returns: {
          success: boolean
          rating_id: string | null
          action: string
          error_message: string | null
        }[]
      }
      get_content_rating_stats: {
        Args: {
          p_content_id: string
        }
        Returns: {
          total_ratings: number
          average_rating: number
          average_accuracy: number | null
          average_clarity: number | null
          average_code_quality: number | null
          average_difficulty_match: number | null
          helpful_percentage: number | null
          recommend_percentage: number | null
          rating_distribution: Json
        }[]
      }
      get_user_ratings: {
        Args: {
          p_user_id: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          rating_id: string
          content_id: string
          content_title: string | null
          content_language: string | null
          content_topic: string | null
          rating: number
          feedback_text: string | null
          was_helpful: boolean | null
          created_at: string
          has_response: boolean
        }[]
      }
      get_top_improvement_requests: {
        Args: {
          p_limit?: number
          p_days?: number
        }
        Returns: {
          improvement_request: string
          request_count: number
        }[]
      }
      get_content_ratings: {
        Args: {
          p_content_id: string
          p_min_rating?: number
          p_with_feedback_only?: boolean
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          rating_id: string
          user_id: string
          user_name: string | null
          rating: number
          accuracy_score: number | null
          clarity_score: number | null
          code_quality_score: number | null
          difficulty_match_score: number | null
          feedback_text: string | null
          was_helpful: boolean | null
          improvement_requests: string[]
          created_at: string
          response_text: string | null
          response_at: string | null
        }[]
      }

      // Learning Progress Functions (019)
      update_learning_progress: {
        Args: {
          p_user_id: string
          p_content_id: string
          p_status?: string | null
          p_progress_percentage?: number | null
          p_time_spent_seconds?: number
          p_quiz_score?: number | null
          p_exercises_completed?: number | null
          p_exercises_total?: number | null
          p_notes?: string | null
        }
        Returns: {
          success: boolean
          progress_id: string | null
          new_status: string | null
          streak_updated: boolean
          error_message: string | null
        }[]
      }
      update_learning_streak: {
        Args: {
          p_user_id: string
        }
        Returns: undefined
      }
      get_user_learning_stats: {
        Args: {
          p_user_id: string
        }
        Returns: {
          total_contents_started: number
          total_contents_completed: number
          total_time_spent_seconds: number
          average_completion_rate: number
          current_streak: number
          longest_streak: number
          total_learning_days: number
          this_week_time_seconds: number
          this_month_time_seconds: number
          favorite_language: string | null
          last_activity_at: string | null
        }[]
      }
      get_recent_learning: {
        Args: {
          p_user_id: string
          p_limit?: number
          p_status?: string | null
        }
        Returns: {
          progress_id: string
          content_id: string
          content_title: string | null
          content_language: string | null
          content_topic: string | null
          status: string
          progress_percentage: number
          time_spent_seconds: number
          last_accessed_at: string
        }[]
      }
      check_and_grant_achievements: {
        Args: {
          p_user_id: string
        }
        Returns: {
          achievement_type: string
          achievement_level: number
          newly_granted: boolean
        }[]
      }

      // Utility Functions (005)
      reset_daily_generations: {
        Args: Record<string, never>
        Returns: undefined
      }
      use_generation_credit: {
        Args: {
          p_user_id: string
        }
        Returns: boolean
      }
      check_expired_subscriptions: {
        Args: Record<string, never>
        Returns: undefined
      }
      expire_credits: {
        Args: Record<string, never>
        Returns: undefined
      }
      generate_order_id: {
        Args: {
          prefix?: string
        }
        Returns: string
      }

      // Admin Functions (015)
      is_admin: {
        Args: {
          p_user_id: string
        }
        Returns: boolean
      }

      // Team Functions (004)
      get_team_member_count: {
        Args: {
          p_team_id: string
        }
        Returns: number
      }
      generate_team_slug: {
        Args: {
          p_name: string
        }
        Returns: string
      }
      increment_api_key_usage: {
        Args: {
          p_key_id: string
        }
        Returns: undefined
      }
      expire_team_invitations: {
        Args: Record<string, never>
        Returns: undefined
      }

      // Transaction Functions (006)
      confirm_credit_payment_atomic: {
        Args: {
          p_payment_id: string
          p_payment_key: string
          p_method: string
          p_receipt_url: string | null
          p_paid_at: string
          p_user_id: string
          p_credits_to_add: number
          p_description: string
          p_expires_at?: string | null
        }
        Returns: {
          success: boolean
          new_balance: number
          error_message: string | null
        }[]
      }
      confirm_subscription_atomic: {
        Args: {
          p_payment_id: string
          p_payment_key: string
          p_method: string
          p_receipt_url: string | null
          p_paid_at: string
          p_user_id: string
          p_plan: string
          p_billing_cycle: string
          p_billing_key_id: string
          p_period_start: string
          p_period_end: string
        }
        Returns: {
          success: boolean
          subscription_id?: string
          error_message?: string
        }[]
      }
      renew_subscription_atomic: {
        Args: {
          p_payment_id: string
          p_payment_key: string
          p_method: string
          p_receipt_url: string | null
          p_paid_at: string
          p_subscription_id: string
          p_new_period_start: string
          p_new_period_end: string
        }
        Returns: {
          success: boolean
          error_message: string | null
        }[]
      }

      // Plan Change Functions (012)
      change_plan_immediate_atomic: {
        Args: {
          p_payment_id: string
          p_payment_key: string
          p_method: string
          p_receipt_url: string | null
          p_paid_at: string
          p_subscription_id: string
          p_new_plan: string
          p_new_billing_cycle: string
          p_prorated_amount: number
        }
        Returns: {
          success: boolean
          error_message: string | null
        }[]
      }
      schedule_plan_change_atomic: {
        Args: {
          p_subscription_id: string
          p_new_plan: string
          p_new_billing_cycle: string
        }
        Returns: {
          success: boolean
          scheduled_at: string | null
          error_message: string | null
        }[]
      }
      cancel_scheduled_plan_change: {
        Args: {
          p_subscription_id: string
        }
        Returns: {
          success: boolean
          error_message: string | null
        }[]
      }
      get_plan_change_preview: {
        Args: {
          p_subscription_id: string
        }
        Returns: {
          plan: string
          billing_cycle: string
          current_period_end: string
          scheduled_plan: string | null
          scheduled_billing_cycle: string | null
          scheduled_change_at: string | null
          is_upgrade: boolean
        }[]
      }
      execute_scheduled_plan_changes: {
        Args: Record<string, never>
        Returns: {
          subscription_id: string
          old_plan: string
          new_plan: string
          changed_at: string
        }[]
      }

      // Payment Stats Functions (013)
      get_payment_stats: {
        Args: {
          p_user_id: string
        }
        Returns: {
          total_amount: number
          refunded_amount: number
          this_month_amount: number
          completed_count: number
          refunded_count: number
        }[]
      }

      // Refund Request Functions (014)
      create_refund_request: {
        Args: {
          p_payment_id: string
          p_user_id: string
          p_requested_amount: number
          p_refund_type: string
          p_reason: string
          p_original_credits?: number | null
          p_used_credits?: number | null
          p_refundable_credits?: number | null
          p_proration_details?: Json | null
        }
        Returns: {
          success: boolean
          request_id: string | null
          error_message: string | null
        }[]
      }
      update_refund_request_status: {
        Args: {
          p_request_id: string
          p_status: string
          p_approved_amount?: number | null
          p_processed_by?: string | null
          p_admin_note?: string | null
          p_rejection_reason?: string | null
          p_toss_response?: Json | null
          p_error?: string | null
        }
        Returns: {
          success: boolean
          error_message: string | null
        }[]
      }
      get_pending_refund_retries: {
        Args: Record<string, never>
        Returns: {
          request_id: string
          payment_id: string
          user_id: string
          requested_amount: number
          refund_type: string
          reason: string
          retry_count: number
          payment_key: string | null
          order_id: string | null
        }[]
      }
      calculate_prorated_refund: {
        Args: {
          p_payment_id: string
          p_user_id: string
        }
        Returns: {
          success: boolean
          original_amount: number
          refundable_amount: number
          original_credits: number
          used_credits: number
          refundable_credits: number
          days_since_purchase: number
          is_within_refund_period: boolean
          error_message: string | null
        }[]
      }

      // Refund Processing Functions (008)
      process_credit_refund_atomic: {
        Args: {
          p_payment_id: string
          p_user_id: string
          p_refund_amount: number
          p_is_partial: boolean
          p_credits_to_deduct: number
          p_reason?: string
        }
        Returns: {
          success: boolean
          new_balance: number
          error_message: string | null
        }[]
      }
      process_subscription_refund_atomic: {
        Args: {
          p_payment_id: string
          p_subscription_id: string
          p_user_id: string
          p_refund_amount: number
          p_is_partial: boolean
          p_reason?: string
        }
        Returns: {
          success: boolean
          error_message: string | null
        }[]
      }
      process_simple_refund_atomic: {
        Args: {
          p_payment_id: string
          p_refund_amount: number
          p_is_partial: boolean
          p_reason?: string
        }
        Returns: {
          success: boolean
          error_message: string | null
        }[]
      }

      // Cron/Scheduled Functions (006)
      expire_credits_safe: {
        Args: Record<string, never>
        Returns: {
          success: boolean
          processed_count: number
          error_message: string | null
        }[]
      }
      reset_daily_generations_safe: {
        Args: Record<string, never>
        Returns: {
          success: boolean
          updated_count: number
          error_message: string | null
        }[]
      }
      get_subscriptions_due_for_renewal: {
        Args: {
          p_hours_ahead?: number
        }
        Returns: {
          subscription_id: string
          user_id: string
          plan: string
          billing_cycle: string
          current_period_end: string
          billing_key_id: string
          cancel_at_period_end: boolean
        }[]
      }
      apply_scheduled_plan_changes: {
        Args: Record<string, never>
        Returns: {
          success: boolean
          processed_count: number
          error_message: string | null
        }[]
      }
      get_scheduled_plan_change: {
        Args: {
          p_subscription_id: string
        }
        Returns: {
          has_scheduled_change: boolean
          current_plan: string
          current_billing_cycle: string
          scheduled_plan: string | null
          scheduled_billing_cycle: string | null
          scheduled_change_at: string | null
        }[]
      }

      // Webhook Functions (010, 020)
      upsert_webhook_log_atomic: {
        Args: {
          p_idempotency_key: string
          p_event_type: string
          p_payload: Json
        }
        Returns: {
          action: string
          log_id: string | null
          existing_status: string | null
        }[]
      }

      // Credit Refund Functions (021)
      deduct_credit_for_refund_atomic: {
        Args: {
          p_user_id: string
          p_amount: number
          p_payment_id: string
          p_description?: string
        }
        Returns: {
          success: boolean
          new_balance: number
          deducted_amount: number
          error_message: string | null
        }[]
      }

      // Generation Credit Functions (006)
      restore_generation_credit: {
        Args: {
          p_user_id: string
          p_use_credits: boolean
          p_topic?: string | null
        }
        Returns: {
          success: boolean
          restored_value: number
          error_message: string | null
        }[]
      }
    }

    Enums: {
      notification_type: NotificationType
      notification_category: NotificationCategory
      notification_channel: NotificationChannel
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ─────────────────────────────────────────────────────────
// Helper Types
// ─────────────────────────────────────────────────────────

type PublicSchema = Database['public']

export type Tables<
  TableName extends keyof PublicSchema['Tables']
> = PublicSchema['Tables'][TableName]['Row']

export type TablesInsert<
  TableName extends keyof PublicSchema['Tables']
> = PublicSchema['Tables'][TableName]['Insert']

export type TablesUpdate<
  TableName extends keyof PublicSchema['Tables']
> = PublicSchema['Tables'][TableName]['Update']

export type Views<
  ViewName extends keyof PublicSchema['Views']
> = PublicSchema['Views'][ViewName]['Row']

export type Enums<
  EnumName extends keyof PublicSchema['Enums']
> = PublicSchema['Enums'][EnumName]

export type Functions<
  FunctionName extends keyof PublicSchema['Functions']
> = PublicSchema['Functions'][FunctionName]

// ─────────────────────────────────────────────────────────
// Convenience Type Aliases
// ─────────────────────────────────────────────────────────

// Core Types
export type Profile = Tables<'profiles'>
export type ProfileInsert = TablesInsert<'profiles'>
export type ProfileUpdate = TablesUpdate<'profiles'>

export type GeneratedContent = Tables<'generated_contents'>
export type GeneratedContentInsert = TablesInsert<'generated_contents'>
export type GeneratedContentUpdate = TablesUpdate<'generated_contents'>

// Payment Types
export type Subscription = Tables<'subscriptions'>
export type SubscriptionInsert = TablesInsert<'subscriptions'>
export type SubscriptionUpdate = TablesUpdate<'subscriptions'>

export type Payment = Tables<'payments'>
export type PaymentInsert = TablesInsert<'payments'>
export type PaymentUpdate = TablesUpdate<'payments'>

export type BillingKey = Tables<'billing_keys'>
export type BillingKeyInsert = TablesInsert<'billing_keys'>
export type BillingKeyUpdate = TablesUpdate<'billing_keys'>

export type CreditTransaction = Tables<'credit_transactions'>
export type CreditTransactionInsert = TablesInsert<'credit_transactions'>
export type CreditTransactionUpdate = TablesUpdate<'credit_transactions'>

export type WebhookLog = Tables<'webhook_logs'>
export type WebhookLogInsert = TablesInsert<'webhook_logs'>
export type WebhookLogUpdate = TablesUpdate<'webhook_logs'>

// Team Types
export type Team = Tables<'teams'>
export type TeamInsert = TablesInsert<'teams'>
export type TeamUpdate = TablesUpdate<'teams'>

export type TeamMember = Tables<'team_members'>
export type TeamMemberInsert = TablesInsert<'team_members'>

export type TeamInvitation = Tables<'team_invitations'>
export type TeamInvitationInsert = TablesInsert<'team_invitations'>
export type TeamInvitationUpdate = TablesUpdate<'team_invitations'>

export type TeamApiKey = Tables<'team_api_keys'>
export type TeamApiKeyInsert = TablesInsert<'team_api_keys'>

export type TeamApiUsage = Tables<'team_api_usage'>
export type TeamApiUsageInsert = TablesInsert<'team_api_usage'>

/**
 * Team with members - composite type for getMyTeam
 */
export interface TeamWithMembers extends Team {
  members: TeamMember[]
  memberCount: number
}

/**
 * Team member with profile - composite type for getTeamMembers
 */
export interface TeamMemberWithProfile extends TeamMember {
  profile: {
    id: string
    email: string
    name: string | null
  } | null
}

// Learning Types
export type LearnerProfile = Tables<'learner_profiles'>
export type LearnerProfileInsert = TablesInsert<'learner_profiles'>
export type LearnerProfileUpdate = TablesUpdate<'learner_profiles'>

export type LevelTest = Tables<'level_tests'>
export type LevelTestInsert = TablesInsert<'level_tests'>

export type LevelTestQuestion = Tables<'level_test_questions'>
export type LevelTestQuestionInsert = TablesInsert<'level_test_questions'>
export type LevelTestQuestionUpdate = TablesUpdate<'level_test_questions'>

export type LearningProgress = Tables<'learning_progress'>
export type LearningProgressInsert = TablesInsert<'learning_progress'>
export type LearningProgressUpdate = TablesUpdate<'learning_progress'>

export type LearningStreak = Tables<'learning_streaks'>
export type LearningStreakInsert = TablesInsert<'learning_streaks'>
export type LearningStreakUpdate = TablesUpdate<'learning_streaks'>

export type DailyLearningLog = Tables<'daily_learning_logs'>
export type DailyLearningLogInsert = TablesInsert<'daily_learning_logs'>

export type Achievement = Tables<'achievements'>
export type AchievementInsert = TablesInsert<'achievements'>

export type AchievementDefinition = Tables<'achievement_definitions'>
export type AchievementDefinitionInsert = TablesInsert<'achievement_definitions'>
export type AchievementDefinitionUpdate = TablesUpdate<'achievement_definitions'>

// Bookmark Types
export type BookmarkFolder = Tables<'bookmark_folders'>
export type BookmarkFolderInsert = TablesInsert<'bookmark_folders'>
export type BookmarkFolderUpdate = TablesUpdate<'bookmark_folders'>

export type ContentBookmark = Tables<'content_bookmarks'>
export type ContentBookmarkInsert = TablesInsert<'content_bookmarks'>
export type ContentBookmarkUpdate = TablesUpdate<'content_bookmarks'>

// Rating Types
export type ContentRating = Tables<'content_ratings'>
export type ContentRatingInsert = TablesInsert<'content_ratings'>
export type ContentRatingUpdate = TablesUpdate<'content_ratings'>

export type FeedbackResponse = Tables<'feedback_responses'>
export type FeedbackResponseInsert = TablesInsert<'feedback_responses'>

export type FeedbackReport = Tables<'feedback_reports'>
export type FeedbackReportInsert = TablesInsert<'feedback_reports'>
export type FeedbackReportUpdate = TablesUpdate<'feedback_reports'>

// Notification Types
export type Notification = Tables<'notifications'>
export type NotificationInsert = TablesInsert<'notifications'>
export type NotificationUpdate = TablesUpdate<'notifications'>

export type NotificationSetting = Tables<'notification_settings'>
export type NotificationSettingInsert = TablesInsert<'notification_settings'>
export type NotificationSettingUpdate = TablesUpdate<'notification_settings'>

export type EmailDigestQueueItem = Tables<'email_digest_queue'>
export type EmailDigestQueueItemInsert = TablesInsert<'email_digest_queue'>

// Custom Application Types (Learning)

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type ProgrammingLanguage = 'python' | 'javascript' | 'sql' | 'java' | 'typescript' | 'go'

/**
 * Level test question for client (without correct_answer to prevent cheating)
 */
export interface LevelTestQuestionClient {
  id: string
  language: ProgrammingLanguage
  difficulty: Difficulty
  question: string
  code_snippet: string | null
  options: Json
  topic: string
  order_index: number
}

/**
 * Level test answer from client
 */
export interface LevelTestAnswer {
  question_id: string
  selected_answer: string
}

/**
 * Level test result after submission
 */
export interface LevelTestResult {
  test_id: string
  score: number
  total_questions: number
  determined_level: ExperienceLevel
  percentage: number
}

/**
 * Onboarding completion result
 */
export interface OnboardingResult {
  success: boolean
  profile_id: string | null
  error_message: string | null
}

// View Types
export type PaymentStats = Views<'payment_stats'>
export type GenerationStats = Views<'generation_stats'>
export type NotificationStats = Views<'notification_stats'>
export type BookmarkStats = Views<'bookmark_stats'>
export type RatingDashboardStats = Views<'rating_dashboard_stats'>
export type RatingStatsByLanguage = Views<'rating_stats_by_language'>
export type LearningLeaderboard = Views<'learning_leaderboard'>
