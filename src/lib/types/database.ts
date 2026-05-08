export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          plan: 'free' | 'starter' | 'growth' | 'enterprise'
          subscription_status: 'active' | 'trialing' | 'past_due' | 'canceled'
          trial_ends_at: string | null
          trial_warning_sent_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          seat_limit: number
          account_limit: number
          logo_url: string | null
          apollo_api_key: string | null
          anthropic_api_key: string | null
          offer_description: string | null
          brand_website_url: string | null
          icp_category: string | null
          icp_city: string | null
          icp_country: string | null
          icp_services: string[] | null
          icp_niches: string[] | null
          enrichment_credits: number
          agent_search_plan: Json | null
          agent_profile_hash: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          plan?: 'free' | 'starter' | 'growth' | 'enterprise'
          subscription_status?: 'active' | 'trialing' | 'past_due' | 'canceled'
          trial_ends_at?: string | null
          trial_warning_sent_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          seat_limit?: number
          account_limit?: number
          logo_url?: string | null
          apollo_api_key?: string | null
          anthropic_api_key?: string | null
          offer_description?: string | null
          brand_website_url?: string | null
          icp_category?: string | null
          icp_city?: string | null
          icp_country?: string | null
          icp_services?: string[] | null
          icp_niches?: string[] | null
          enrichment_credits?: number
          agent_search_plan?: Json | null
          agent_profile_hash?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['workspaces']['Insert']>
        Relationships: []
      }
      users: {
        Row: {
          id: string
          workspace_id: string
          full_name: string
          email: string
          role: 'owner' | 'admin' | 'member'
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          workspace_id: string
          full_name: string
          email: string
          role?: 'owner' | 'admin' | 'member'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'users_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      invitations: {
        Row: {
          id: string
          workspace_id: string
          email: string
          role: 'owner' | 'admin' | 'member'
          token: string
          status: 'pending' | 'accepted'
          invited_by: string | null
          created_at: string
          accepted_at: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          email: string
          role?: 'owner' | 'admin' | 'member'
          token?: string
          status?: 'pending' | 'accepted'
          invited_by?: string | null
          created_at?: string
          accepted_at?: string | null
          expires_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['invitations']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'invitations_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      icps: {
        Row: {
          id: string
          workspace_id: string
          name: string
          raw_description: string | null
          extracted_params: Json | null
          industries: string[]
          company_size_min: number | null
          company_size_max: number | null
          locations: string[]
          keywords: string[]
          technologies: string[]
          funding_stages: string[]
          employee_ranges: string[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          raw_description?: string | null
          extracted_params?: Json | null
          industries?: string[]
          company_size_min?: number | null
          company_size_max?: number | null
          locations?: string[]
          keywords?: string[]
          technologies?: string[]
          funding_stages?: string[]
          employee_ranges?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['icps']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'icps_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      accounts: {
        Row: {
          id: string
          workspace_id: string
          name: string
          domain: string | null
          industry: string | null
          employee_count: number | null
          location: string | null
          ai_score: number | null
          ai_score_reason: string | null
          technology_stack: string[]
          funding_stage: string | null
          status: 'new' | 'contacted' | 'in_progress' | 'qualified' | 'not_a_fit'
          website: string | null
          linkedin_url: string | null
          description: string | null
          icp_id: string | null
          last_activity_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          domain?: string | null
          industry?: string | null
          employee_count?: number | null
          location?: string | null
          ai_score?: number | null
          ai_score_reason?: string | null
          technology_stack?: string[]
          funding_stage?: string | null
          status?: 'new' | 'contacted' | 'in_progress' | 'qualified' | 'not_a_fit'
          website?: string | null
          linkedin_url?: string | null
          description?: string | null
          icp_id?: string | null
          last_activity_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['accounts']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'accounts_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      contacts: {
        Row: {
          id: string
          workspace_id: string
          account_id: string | null
          first_name: string
          last_name: string | null
          email: string | null
          phone: string | null
          title: string | null
          linkedin_url: string | null
          avatar_url: string | null
          is_unsubscribed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          account_id?: string | null
          first_name: string
          last_name?: string | null
          email?: string | null
          phone?: string | null
          title?: string | null
          linkedin_url?: string | null
          avatar_url?: string | null
          is_unsubscribed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'contacts_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      deals: {
        Row: {
          id: string
          workspace_id: string
          account_id: string | null
          contact_id: string | null
          owner_id: string | null
          name: string
          value: number | null
          currency: string
          stage: 'discovery' | 'demo' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
          close_date: string | null
          notes: string | null
          health: 'green' | 'amber' | 'red' | null
          ai_health_score: number | null
          ai_health_reason: string | null
          ai_health_factors: { label: string; status: 'positive' | 'neutral' | 'negative'; detail: string }[] | null
          stall_detected_at: string | null
          deleted_at: string | null
          last_activity_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          account_id?: string | null
          contact_id?: string | null
          owner_id?: string | null
          name: string
          value?: number | null
          currency?: string
          stage?: 'discovery' | 'demo' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
          close_date?: string | null
          notes?: string | null
          health?: 'green' | 'amber' | 'red' | null
          ai_health_score?: number | null
          ai_health_reason?: string | null
          ai_health_factors?: { label: string; status: 'positive' | 'neutral' | 'negative'; detail: string }[] | null
          stall_detected_at?: string | null
          deleted_at?: string | null
          last_activity_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['deals']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'deals_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      activities: {
        Row: {
          id: string
          workspace_id: string
          account_id: string | null
          contact_id: string | null
          deal_id: string | null
          user_id: string | null
          type: 'email' | 'meeting' | 'call' | 'note' | 'linkedin'
          direction: 'inbound' | 'outbound' | null
          source: 'gmail' | 'calendar' | 'aircall' | 'manual' | 'linkedin'
          subject: string | null
          body: string | null
          summary: string | null
          sentiment: 'positive' | 'neutral' | 'negative' | null
          occurred_at: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          account_id?: string | null
          contact_id?: string | null
          deal_id?: string | null
          user_id?: string | null
          type: 'email' | 'meeting' | 'call' | 'note' | 'linkedin'
          direction?: 'inbound' | 'outbound' | null
          source?: 'gmail' | 'calendar' | 'aircall' | 'manual' | 'linkedin'
          subject?: string | null
          body?: string | null
          summary?: string | null
          sentiment?: 'positive' | 'neutral' | 'negative' | null
          occurred_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['activities']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'activities_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      sequences: {
        Row: {
          id: string
          workspace_id: string
          owner_id: string | null
          name: string
          status: 'draft' | 'active' | 'paused'
          steps: Json
          sending_account: string | null
          send_window: string | null
          ai_personalization: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          owner_id?: string | null
          name: string
          status?: 'draft' | 'active' | 'paused'
          steps?: Json
          sending_account?: string | null
          send_window?: string | null
          ai_personalization?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['sequences']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'sequences_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      sequence_enrollments: {
        Row: {
          id: string
          sequence_id: string
          contact_id: string
          workspace_id: string
          status: 'active' | 'paused' | 'completed' | 'replied' | 'unsubscribed' | 'bounced'
          current_step: number
          enrolled_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          sequence_id: string
          contact_id: string
          workspace_id: string
          status?: 'active' | 'paused' | 'completed' | 'replied' | 'unsubscribed' | 'bounced'
          current_step?: number
          enrolled_at?: string
          completed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['sequence_enrollments']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'sequence_enrollments_sequence_id_fkey'
            columns: ['sequence_id']
            isOneToOne: false
            referencedRelation: 'sequences'
            referencedColumns: ['id']
          }
        ]
      }
      sequence_step_logs: {
        Row: {
          id: string
          enrollment_id: string
          sequence_id: string
          step_number: number
          type: 'email' | 'meeting' | 'call' | 'note' | 'linkedin'
          subject: string | null
          body: string | null
          sent_at: string | null
          opened_at: string | null
          replied_at: string | null
          bounced_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          enrollment_id: string
          sequence_id: string
          step_number: number
          type: 'email' | 'meeting' | 'call' | 'note' | 'linkedin'
          subject?: string | null
          body?: string | null
          sent_at?: string | null
          opened_at?: string | null
          replied_at?: string | null
          bounced_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['sequence_step_logs']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'sequence_step_logs_enrollment_id_fkey'
            columns: ['enrollment_id']
            isOneToOne: false
            referencedRelation: 'sequence_enrollments'
            referencedColumns: ['id']
          }
        ]
      }
      tam_build_jobs: {
        Row: {
          id: string
          workspace_id: string | null
          icp_id: string | null
          status: 'running' | 'complete' | 'error'
          step_finding_done: boolean
          step_finding_count: number
          step_enriching_done: boolean
          step_enriching_count: number
          step_scoring_done: boolean
          step_scoring_count: number
          total_accounts: number
          error_message: string | null
          started_at: string
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          icp_id?: string | null
          status?: 'running' | 'complete' | 'error'
          step_finding_done?: boolean
          step_finding_count?: number
          step_enriching_done?: boolean
          step_enriching_count?: number
          step_scoring_done?: boolean
          step_scoring_count?: number
          total_accounts?: number
          error_message?: string | null
          started_at?: string
          completed_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['tam_build_jobs']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'tam_build_jobs_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      workspace_members: {
        Row: {
          user_id: string
          workspace_id: string
          role: 'owner' | 'admin' | 'member'
          joined_at: string
        }
        Insert: {
          user_id: string
          workspace_id: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
        }
        Update: Partial<Database['public']['Tables']['workspace_members']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      lead_searches: {
        Row: {
          id: string
          workspace_id: string
          user_id: string | null
          category: string | null
          city: string | null
          country: string | null
          offer_description: string | null
          status: 'pending' | 'running' | 'done' | 'error'
          result_count: number | null
          apify_run_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          offer_description?: string | null
          status?: 'pending' | 'running' | 'done' | 'error'
          result_count?: number | null
          apify_run_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['lead_searches']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'lead_searches_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      leads: {
        Row: {
          id: string
          search_id: string
          workspace_id: string
          name: string | null
          category: string | null
          address: string | null
          phone: string | null
          website: string | null
          rating: number | null
          review_count: number | null
          google_maps_url: string | null
          place_id: string | null
          surface_score: number | null
          enrichment_status: 'none' | 'loading' | 'done' | 'error'
          enriched_at: string | null
          website_tech: Json | null
          website_quality_score: number | null
          has_booking_system: boolean | null
          has_social_presence: boolean | null
          social_links: Json | null
          review_sentiment: 'positive' | 'mixed' | 'negative' | null
          last_review_date: string | null
          owner_response_rate: number | null
          opportunity_score: number | null
          score_reasoning: string | null
          outreach_email: string | null
          discovered_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          search_id: string
          workspace_id: string
          name?: string | null
          category?: string | null
          address?: string | null
          phone?: string | null
          website?: string | null
          rating?: number | null
          review_count?: number | null
          google_maps_url?: string | null
          place_id?: string | null
          surface_score?: number | null
          enrichment_status?: 'none' | 'loading' | 'done' | 'error'
          enriched_at?: string | null
          website_tech?: Json | null
          website_quality_score?: number | null
          has_booking_system?: boolean | null
          has_social_presence?: boolean | null
          social_links?: Json | null
          review_sentiment?: 'positive' | 'mixed' | 'negative' | null
          last_review_date?: string | null
          owner_response_rate?: number | null
          opportunity_score?: number | null
          score_reasoning?: string | null
          outreach_email?: string | null
          discovered_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['leads']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'leads_search_id_fkey'
            columns: ['search_id']
            isOneToOne: false
            referencedRelation: 'lead_searches'
            referencedColumns: ['id']
          }
        ]
      }
      agent_runs: {
        Row: {
          id: string
          workspace_id: string
          search_query: string
          location_query: string
          fingerprint: string
          leads_found: number
          leads_enriched: number
          status: string
          error_message: string | null
          ran_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          search_query: string
          location_query: string
          fingerprint: string
          leads_found?: number
          leads_enriched?: number
          status?: string
          error_message?: string | null
          ran_at?: string
        }
        Update: Partial<Database['public']['Tables']['agent_runs']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'agent_runs_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      ai_chats: {
        Row: {
          id: string
          workspace_id: string
          user_id: string | null
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id?: string | null
          title?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['ai_chats']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'ai_chats_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      ai_messages: {
        Row: {
          id: string
          chat_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['ai_messages']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'ai_messages_chat_id_fkey'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'ai_chats'
            referencedColumns: ['id']
          }
        ]
      }
      signals: {        Row: {
          id: string
          workspace_id: string
          account_id: string | null
          type: 'hiring' | 'funding' | 'tech_change' | 'web_visit' | 'news' | 'job_change'
          title: string
          body: string | null
          source_url: string | null
          relevance_score: number | null
          is_read: boolean
          detected_at: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          account_id?: string | null
          type: 'hiring' | 'funding' | 'tech_change' | 'web_visit' | 'news' | 'job_change'
          title: string
          body?: string | null
          source_url?: string | null
          relevance_score?: number | null
          is_read?: boolean
          detected_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['signals']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'signals_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_workspace_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: 'owner' | 'admin' | 'member'
      }
    }
    Enums: {
      plan_type: 'free' | 'starter' | 'growth' | 'enterprise'
      subscription_status: 'active' | 'trialing' | 'past_due' | 'canceled'
      user_role: 'owner' | 'admin' | 'member'
      invite_status: 'pending' | 'accepted'
      account_status: 'new' | 'contacted' | 'in_progress' | 'qualified' | 'not_a_fit'
      deal_stage: 'discovery' | 'demo' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
      activity_type: 'email' | 'meeting' | 'call' | 'note' | 'linkedin'
      activity_direction: 'inbound' | 'outbound'
      activity_source: 'gmail' | 'calendar' | 'aircall' | 'manual' | 'linkedin'
      sequence_status: 'draft' | 'active' | 'paused'
      enrollment_status: 'active' | 'paused' | 'completed' | 'replied' | 'unsubscribed' | 'bounced'
      signal_type: 'hiring' | 'funding' | 'tech_change' | 'web_visit' | 'news' | 'job_change'
      sentiment: 'positive' | 'neutral' | 'negative'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
