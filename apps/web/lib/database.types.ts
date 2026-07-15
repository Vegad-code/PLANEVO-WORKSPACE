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
      workspaces: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          icon: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          icon?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          icon?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pages: {
        Row: {
          id: string;
          workspace_id: string;
          parent_page_id: string | null;
          title: string;
          icon: string | null;
          content_json: Json;
          database_id: string | null;
          position: number;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          parent_page_id?: string | null;
          title?: string;
          icon?: string | null;
          content_json?: Json;
          database_id?: string | null;
          position?: number;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          parent_page_id?: string | null;
          title?: string;
          icon?: string | null;
          content_json?: Json;
          database_id?: string | null;
          position?: number;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      databases: {
        Row: {
          id: string;
          workspace_id: string;
          page_id: string | null;
          name: string;
          icon: string | null;
          template_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          page_id?: string | null;
          name: string;
          icon?: string | null;
          template_type?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          page_id?: string | null;
          name?: string;
          icon?: string | null;
          template_type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      database_properties: {
        Row: {
          id: string;
          database_id: string;
          name: string;
          type: string;
          config_json: Json;
          position: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          database_id: string;
          name: string;
          type: string;
          config_json?: Json;
          position?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          database_id?: string;
          name?: string;
          type?: string;
          config_json?: Json;
          position?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      records: {
        Row: {
          id: string;
          database_id: string;
          position: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          database_id: string;
          position?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          database_id?: string;
          position?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      record_values: {
        Row: {
          id: string;
          record_id: string;
          property_id: string;
          value_json: Json;
        };
        Insert: {
          id?: string;
          record_id: string;
          property_id: string;
          value_json?: Json;
        };
        Update: {
          id?: string;
          record_id?: string;
          property_id?: string;
          value_json?: Json;
        };
        Relationships: [];
      };
      relations: {
        Row: {
          id: string;
          source_record_id: string;
          source_property_id: string;
          target_record_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_record_id: string;
          source_property_id: string;
          target_record_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_record_id?: string;
          source_property_id?: string;
          target_record_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      views: {
        Row: {
          id: string;
          database_id: string;
          type: string;
          name: string;
          config_json: Json;
          position: number;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          database_id: string;
          type: string;
          name: string;
          config_json?: Json;
          position?: number;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          database_id?: string;
          type?: string;
          name?: string;
          config_json?: Json;
          position?: number;
          is_default?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      agent_sessions: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          context_page_id: string | null;
          context_database_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          context_page_id?: string | null;
          context_database_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          context_page_id?: string | null;
          context_database_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      agent_actions: {
        Row: {
          id: string;
          workspace_id: string;
          session_id: string | null;
          action_type: string;
          target_type: string | null;
          target_id: string | null;
          payload_json: Json;
          status: string;
          created_at: string;
          confirmed_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          session_id?: string | null;
          action_type: string;
          target_type?: string | null;
          target_id?: string | null;
          payload_json?: Json;
          status?: string;
          created_at?: string;
          confirmed_at?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          session_id?: string | null;
          action_type?: string;
          target_type?: string | null;
          target_id?: string | null;
          payload_json?: Json;
          status?: string;
          created_at?: string;
          confirmed_at?: string | null;
        };
        Relationships: [];
      };
      agents: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          icon: string | null;
          description: string | null;
          instructions: string | null;
          model_config_json: Json;
          knowledge_scope_json: Json;
          workflow_config_json: Json;
          visibility: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          icon?: string | null;
          description?: string | null;
          instructions?: string | null;
          model_config_json?: Json;
          knowledge_scope_json?: Json;
          workflow_config_json?: Json;
          visibility?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          icon?: string | null;
          description?: string | null;
          instructions?: string | null;
          model_config_json?: Json;
          knowledge_scope_json?: Json;
          workflow_config_json?: Json;
          visibility?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      credit_ledger: {
        Row: {
          id: string;
          user_id: string;
          delta: number;
          reason: string;
          model_used: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          delta: number;
          reason: string;
          model_used?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          delta?: number;
          reason?: string;
          model_used?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
export type PageRow = Database["public"]["Tables"]["pages"]["Row"];
