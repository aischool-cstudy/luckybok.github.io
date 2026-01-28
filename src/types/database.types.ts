// Supabase Database Types
// 이 파일은 `npx supabase gen types typescript --local` 명령으로 생성됩니다.
// 개발 초기에는 수동으로 타입을 정의하고, Supabase 연동 후 자동 생성합니다.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          plan: 'starter' | 'pro' | 'team' | 'enterprise';
          daily_generations_remaining: number;
          daily_reset_at: string | null;
          credits_balance: number;
          plan_expires_at: string | null;
          customer_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          plan?: 'starter' | 'pro' | 'team' | 'enterprise';
          daily_generations_remaining?: number;
          daily_reset_at?: string | null;
          credits_balance?: number;
          plan_expires_at?: string | null;
          customer_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          plan?: 'starter' | 'pro' | 'team' | 'enterprise';
          daily_generations_remaining?: number;
          daily_reset_at?: string | null;
          credits_balance?: number;
          plan_expires_at?: string | null;
          customer_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      generated_contents: {
        Row: {
          id: string;
          user_id: string;
          language: string;
          topic: string;
          difficulty: string;
          target_audience: string;
          title: string | null;
          content: string;
          code_examples: Json | null;
          quiz: Json | null;
          model_used: string | null;
          tokens_used: number | null;
          generation_time_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          language: string;
          topic: string;
          difficulty: string;
          target_audience: string;
          title?: string | null;
          content: string;
          code_examples?: Json | null;
          quiz?: Json | null;
          model_used?: string | null;
          tokens_used?: number | null;
          generation_time_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          language?: string;
          topic?: string;
          difficulty?: string;
          target_audience?: string;
          title?: string | null;
          content?: string;
          code_examples?: Json | null;
          quiz?: Json | null;
          model_used?: string | null;
          tokens_used?: number | null;
          generation_time_ms?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'generated_contents_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: 'pro' | 'team' | 'enterprise';
          billing_cycle: 'monthly' | 'yearly';
          status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          billing_key_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan: 'pro' | 'team' | 'enterprise';
          billing_cycle: 'monthly' | 'yearly';
          status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          billing_key_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan?: 'pro' | 'team' | 'enterprise';
          billing_cycle?: 'monthly' | 'yearly';
          status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
          current_period_start?: string;
          current_period_end?: string;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          billing_key_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_billing_key_id_fkey';
            columns: ['billing_key_id'];
            isOneToOne: false;
            referencedRelation: 'billing_keys';
            referencedColumns: ['id'];
          }
        ];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          order_id: string;
          payment_key: string | null;
          type: 'subscription' | 'credit_purchase';
          status: 'pending' | 'completed' | 'failed' | 'canceled' | 'refunded' | 'partial_refunded';
          amount: number;
          method: string | null;
          receipt_url: string | null;
          metadata: Json;
          failure_code: string | null;
          failure_reason: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_id: string;
          payment_key?: string | null;
          type: 'subscription' | 'credit_purchase';
          status?: 'pending' | 'completed' | 'failed' | 'canceled' | 'refunded' | 'partial_refunded';
          amount: number;
          method?: string | null;
          receipt_url?: string | null;
          metadata?: Json;
          failure_code?: string | null;
          failure_reason?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_id?: string;
          payment_key?: string | null;
          type?: 'subscription' | 'credit_purchase';
          status?: 'pending' | 'completed' | 'failed' | 'canceled' | 'refunded' | 'partial_refunded';
          amount?: number;
          method?: string | null;
          receipt_url?: string | null;
          metadata?: Json;
          failure_code?: string | null;
          failure_reason?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      billing_keys: {
        Row: {
          id: string;
          user_id: string;
          customer_key: string;
          encrypted_billing_key: string;
          card_company: string;
          card_number: string;
          card_type: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          customer_key: string;
          encrypted_billing_key: string;
          card_company: string;
          card_number: string;
          card_type?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          customer_key?: string;
          encrypted_billing_key?: string;
          card_company?: string;
          card_number?: string;
          card_type?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_keys_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          type: 'purchase' | 'subscription_grant' | 'usage' | 'refund' | 'expiry' | 'admin_adjustment';
          amount: number;
          balance: number;
          description: string | null;
          payment_id: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'purchase' | 'subscription_grant' | 'usage' | 'refund' | 'expiry' | 'admin_adjustment';
          amount: number;
          balance: number;
          description?: string | null;
          payment_id?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'purchase' | 'subscription_grant' | 'usage' | 'refund' | 'expiry' | 'admin_adjustment';
          amount?: number;
          balance?: number;
          description?: string | null;
          payment_id?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'credit_transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'credit_transactions_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          }
        ];
      };
      webhook_logs: {
        Row: {
          id: string;
          event_type: string;
          payload: Json;
          processed_at: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          payload: Json;
          processed_at?: string | null;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          payload?: Json;
          processed_at?: string | null;
          error?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// 편의를 위한 타입 별칭
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type GeneratedContent = Database['public']['Tables']['generated_contents']['Row'];
export type GeneratedContentInsert = Database['public']['Tables']['generated_contents']['Insert'];
export type GeneratedContentUpdate = Database['public']['Tables']['generated_contents']['Update'];

export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
export type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];

export type Payment = Database['public']['Tables']['payments']['Row'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
export type PaymentUpdate = Database['public']['Tables']['payments']['Update'];

export type BillingKey = Database['public']['Tables']['billing_keys']['Row'];
export type BillingKeyInsert = Database['public']['Tables']['billing_keys']['Insert'];
export type BillingKeyUpdate = Database['public']['Tables']['billing_keys']['Update'];

export type CreditTransaction = Database['public']['Tables']['credit_transactions']['Row'];
export type CreditTransactionInsert = Database['public']['Tables']['credit_transactions']['Insert'];
export type CreditTransactionUpdate = Database['public']['Tables']['credit_transactions']['Update'];

export type WebhookLog = Database['public']['Tables']['webhook_logs']['Row'];
export type WebhookLogInsert = Database['public']['Tables']['webhook_logs']['Insert'];
export type WebhookLogUpdate = Database['public']['Tables']['webhook_logs']['Update'];
