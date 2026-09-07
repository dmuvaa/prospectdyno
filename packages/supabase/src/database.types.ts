export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          company_name: string | null;
          website: string | null;
          credit_balance: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          company_name?: string | null;
          website?: string | null;
          credit_balance?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          company_name?: string | null;
          website?: string | null;
          credit_balance?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: "owner" | "admin" | "member" | "viewer";
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role: "owner" | "admin" | "member" | "viewer";
          created_at?: string;
        };
        Update: {
          workspace_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "member" | "viewer";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      icps: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          original_prompt: string;
          interpretation: Json;
          criteria: Json;
          custom_criteria: Json;
          status: "draft" | "pending_review" | "approved" | "archived";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          original_prompt: string;
          interpretation?: Json;
          criteria?: Json;
          custom_criteria?: Json;
          status?: "draft" | "pending_review" | "approved" | "archived";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          original_prompt?: string;
          interpretation?: Json;
          criteria?: Json;
          custom_criteria?: Json;
          status?: "draft" | "pending_review" | "approved" | "archived";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      icp_versions: {
        Row: {
          id: string;
          icp_id: string;
          workspace_id: string;
          version: number;
          original_prompt: string;
          interpretation: Json;
          criteria: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          icp_id: string;
          workspace_id: string;
          version: number;
          original_prompt: string;
          interpretation: Json;
          criteria: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          icp_id?: string;
          workspace_id?: string;
          version?: number;
          original_prompt?: string;
          interpretation?: Json;
          criteria?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          workspace_id: string;
          job_type: string;
          entity_type: string | null;
          entity_id: string | null;
          input: Json;
          output: Json | null;
          status: "pending" | "running" | "completed" | "failed" | "cancelled";
          attempts: number;
          error: string | null;
          cost: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          job_type: string;
          entity_type?: string | null;
          entity_id?: string | null;
          input?: Json;
          output?: Json | null;
          status?: "pending" | "running" | "completed" | "failed" | "cancelled";
          attempts?: number;
          error?: string | null;
          cost?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          job_type?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          input?: Json;
          output?: Json | null;
          status?: "pending" | "running" | "completed" | "failed" | "cancelled";
          attempts?: number;
          error?: string | null;
          cost?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usage_events: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          event_type: string;
          quantity: number;
          unit_cost: number;
          total_cost: number;
          credits: number;
          metadata: Json;
          idempotency_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          event_type: string;
          quantity?: number;
          unit_cost?: number;
          total_cost?: number;
          credits?: number;
          metadata?: Json;
          idempotency_key?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string | null;
          event_type?: string;
          quantity?: number;
          unit_cost?: number;
          total_cost?: number;
          credits?: number;
          metadata?: Json;
          idempotency_key?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          workspace_id: string | null;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string | null;
          user_id?: string | null;
          action?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          domain: string | null;
          normalized_domain: string | null;
          website: string | null;
          country: string | null;
          city: string | null;
          industry: string | null;
          description: string | null;
          employee_count: number | null;
          status:
            | "NEW"
            | "RESEARCHING"
            | "QUALIFIED"
            | "SAVED"
            | "CONTACTED"
            | "REPLIED"
            | "INTERESTED"
            | "MEETING"
            | "CUSTOMER"
            | "NOT_INTERESTED"
            | "SUPPRESSED";
          notes: string | null;
          tags: string[];
          source: string;
          source_metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          domain?: string | null;
          normalized_domain?: string | null;
          website?: string | null;
          country?: string | null;
          city?: string | null;
          industry?: string | null;
          description?: string | null;
          employee_count?: number | null;
          status?:
            | "NEW"
            | "RESEARCHING"
            | "QUALIFIED"
            | "SAVED"
            | "CONTACTED"
            | "REPLIED"
            | "INTERESTED"
            | "MEETING"
            | "CUSTOMER"
            | "NOT_INTERESTED"
            | "SUPPRESSED";
          notes?: string | null;
          tags?: string[];
          source?: string;
          source_metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          domain?: string | null;
          normalized_domain?: string | null;
          website?: string | null;
          country?: string | null;
          city?: string | null;
          industry?: string | null;
          description?: string | null;
          employee_count?: number | null;
          status?:
            | "NEW"
            | "RESEARCHING"
            | "QUALIFIED"
            | "SAVED"
            | "CONTACTED"
            | "REPLIED"
            | "INTERESTED"
            | "MEETING"
            | "CUSTOMER"
            | "NOT_INTERESTED"
            | "SUPPRESSED";
          notes?: string | null;
          tags?: string[];
          source?: string;
          source_metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          workspace_id: string;
          company_id: string;
          name: string | null;
          title: string | null;
          seniority: string | null;
          email: string | null;
          phone: string | null;
          source: string | null;
          confidence: "high" | "medium" | "low" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          company_id: string;
          name?: string | null;
          title?: string | null;
          seniority?: string | null;
          email?: string | null;
          phone?: string | null;
          source?: string | null;
          confidence?: "high" | "medium" | "low" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          company_id?: string;
          name?: string | null;
          title?: string | null;
          seniority?: string | null;
          email?: string | null;
          phone?: string | null;
          source?: string | null;
          confidence?: "high" | "medium" | "low" | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      searches: {
        Row: {
          id: string;
          workspace_id: string;
          icp_id: string | null;
          name: string;
          provider: "apify" | "csv" | "website" | "manual";
          original_request: string | null;
          strategy: Json;
          input: Json;
          status: "draft" | "queued" | "running" | "completed" | "failed" | "cancelled";
          result_count: number;
          opportunity_count: number;
          cost: number;
          error: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          icp_id?: string | null;
          name: string;
          provider?: "apify" | "csv" | "website" | "manual";
          original_request?: string | null;
          strategy?: Json;
          input?: Json;
          status?: "draft" | "queued" | "running" | "completed" | "failed" | "cancelled";
          result_count?: number;
          opportunity_count?: number;
          cost?: number;
          error?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          icp_id?: string | null;
          name?: string;
          provider?: "apify" | "csv" | "website" | "manual";
          original_request?: string | null;
          strategy?: Json;
          input?: Json;
          status?: "draft" | "queued" | "running" | "completed" | "failed" | "cancelled";
          result_count?: number;
          opportunity_count?: number;
          cost?: number;
          error?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      search_results: {
        Row: {
          id: string;
          workspace_id: string;
          search_id: string;
          company_id: string;
          raw: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          search_id: string;
          company_id: string;
          raw?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          search_id?: string;
          company_id?: string;
          raw?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      website_audits: {
        Row: {
          id: string;
          workspace_id: string;
          company_id: string;
          website_score: number | null;
          seo_score: number | null;
          performance_score: number | null;
          ux_score: number | null;
          conversion_score: number | null;
          technical_score: number | null;
          summary: Json;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          company_id: string;
          website_score?: number | null;
          seo_score?: number | null;
          performance_score?: number | null;
          ux_score?: number | null;
          conversion_score?: number | null;
          technical_score?: number | null;
          summary?: Json;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          company_id?: string;
          website_score?: number | null;
          seo_score?: number | null;
          performance_score?: number | null;
          ux_score?: number | null;
          conversion_score?: number | null;
          technical_score?: number | null;
          summary?: Json;
          details?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      evidence_records: {
        Row: {
          id: string;
          workspace_id: string;
          company_id: string | null;
          contact_id: string | null;
          opportunity_id: string | null;
          claim: string;
          evidence: string | null;
          source_url: string | null;
          source_type: string | null;
          extracted_text: string | null;
          confidence: "high" | "medium" | "low" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          company_id?: string | null;
          contact_id?: string | null;
          opportunity_id?: string | null;
          claim: string;
          evidence?: string | null;
          source_url?: string | null;
          source_type?: string | null;
          extracted_text?: string | null;
          confidence?: "high" | "medium" | "low" | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          company_id?: string | null;
          contact_id?: string | null;
          opportunity_id?: string | null;
          claim?: string;
          evidence?: string | null;
          source_url?: string | null;
          source_type?: string | null;
          extracted_text?: string | null;
          confidence?: "high" | "medium" | "low" | null;
          created_at?: string;
        };
        Relationships: [];
      };
      opportunities: {
        Row: {
          id: string;
          workspace_id: string;
          company_id: string;
          search_id: string | null;
          icp_id: string | null;
          fit_score: number;
          intent_score: number;
          opportunity_score: number;
          contactability_score: number;
          confidence_score: number;
          why: Json;
          recommended_service: string | null;
          recommended_angle: string | null;
          recommended_contact: string | null;
          report: Json;
          status:
            | "NEW"
            | "RESEARCHING"
            | "QUALIFIED"
            | "SAVED"
            | "CONTACTED"
            | "REPLIED"
            | "INTERESTED"
            | "MEETING"
            | "CUSTOMER"
            | "NOT_INTERESTED"
            | "SUPPRESSED";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          company_id: string;
          search_id?: string | null;
          icp_id?: string | null;
          fit_score?: number;
          intent_score?: number;
          opportunity_score?: number;
          contactability_score?: number;
          confidence_score?: number;
          why?: Json;
          recommended_service?: string | null;
          recommended_angle?: string | null;
          recommended_contact?: string | null;
          report?: Json;
          status?:
            | "NEW"
            | "RESEARCHING"
            | "QUALIFIED"
            | "SAVED"
            | "CONTACTED"
            | "REPLIED"
            | "INTERESTED"
            | "MEETING"
            | "CUSTOMER"
            | "NOT_INTERESTED"
            | "SUPPRESSED";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          company_id?: string;
          search_id?: string | null;
          icp_id?: string | null;
          fit_score?: number;
          intent_score?: number;
          opportunity_score?: number;
          contactability_score?: number;
          confidence_score?: number;
          why?: Json;
          recommended_service?: string | null;
          recommended_angle?: string | null;
          recommended_contact?: string | null;
          report?: Json;
          status?:
            | "NEW"
            | "RESEARCHING"
            | "QUALIFIED"
            | "SAVED"
            | "CONTACTED"
            | "REPLIED"
            | "INTERESTED"
            | "MEETING"
            | "CUSTOMER"
            | "NOT_INTERESTED"
            | "SUPPRESSED";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lists: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      list_members: {
        Row: {
          list_id: string;
          company_id: string;
          workspace_id: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          list_id: string;
          company_id: string;
          workspace_id: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          list_id?: string;
          company_id?: string;
          workspace_id?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          workspace_id: string;
          company_id: string;
          opportunity_id: string | null;
          opening_line: string | null;
          angle: string | null;
          cta: string | null;
          body: string;
          evidence: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          company_id: string;
          opportunity_id?: string | null;
          opening_line?: string | null;
          angle?: string | null;
          cta?: string | null;
          body: string;
          evidence?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          company_id?: string;
          opportunity_id?: string | null;
          opening_line?: string | null;
          angle?: string | null;
          cta?: string | null;
          body?: string;
          evidence?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      suppression_records: {
        Row: {
          id: string;
          workspace_id: string;
          email: string | null;
          domain: string | null;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email?: string | null;
          domain?: string | null;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          email?: string | null;
          domain?: string | null;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_workspace: {
        Args: { workspace_name: string };
        Returns: Database["public"]["Tables"]["workspaces"]["Row"];
      };
      is_workspace_member: {
        Args: { _workspace_id: string };
        Returns: boolean;
      };
      has_workspace_role: {
        Args: { _workspace_id: string; _roles: string[] };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
