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
          settings_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          icon?: string | null;
          settings_json?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          icon?: string | null;
          settings_json?: Json;
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
          cover_image: string | null;
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
          cover_image?: string | null;
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
          cover_image?: string | null;
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
          content_json: Json;
          deleted_at: string | null;
          source_block_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          database_id: string;
          position?: number;
          content_json?: Json;
          deleted_at?: string | null;
          source_block_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          database_id?: string;
          position?: number;
          content_json?: Json;
          deleted_at?: string | null;
          source_block_id?: string | null;
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
      user_preferences: {
        Row: { user_id: string; theme: string; minimal: boolean; settings_json: Json; created_at: string; updated_at: string };
        Insert: { user_id: string; theme?: string; minimal?: boolean; settings_json?: Json; created_at?: string; updated_at?: string };
        Update: { user_id?: string; theme?: string; minimal?: boolean; settings_json?: Json; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      recent_items: {
        Row: { id: string; user_id: string; workspace_id: string; target_type: string; target_id: string; last_opened_at: string };
        Insert: { id?: string; user_id: string; workspace_id: string; target_type: string; target_id: string; last_opened_at?: string };
        Update: { id?: string; user_id?: string; workspace_id?: string; target_type?: string; target_id?: string; last_opened_at?: string };
        Relationships: [];
      };
      onboarding_progress: {
        Row: { user_id: string; workspace_id: string | null; organizing: string | null; current_step: number; completed_steps_json: Json; completed_at: string | null; created_at: string; updated_at: string };
        Insert: { user_id: string; workspace_id?: string | null; organizing?: string | null; current_step?: number; completed_steps_json?: Json; completed_at?: string | null; created_at?: string; updated_at?: string };
        Update: { user_id?: string; workspace_id?: string | null; organizing?: string | null; current_step?: number; completed_steps_json?: Json; completed_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      file_sources: {
        Row: { id: string; workspace_id: string; page_id: string | null; created_by: string; user_id: string | null; storage_path: string; name: string; mime_type: string | null; size_bytes: number | null; ingestion_status: string; metadata_json: Json; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; page_id?: string | null; created_by: string; user_id?: string | null; storage_path: string; name: string; mime_type?: string | null; size_bytes?: number | null; ingestion_status?: string; metadata_json?: Json; created_at?: string; updated_at?: string };
        Update: { id?: string; workspace_id?: string; page_id?: string | null; created_by?: string; user_id?: string | null; storage_path?: string; name?: string; mime_type?: string | null; size_bytes?: number | null; ingestion_status?: string; metadata_json?: Json; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      integration_connections: {
        Row: { id: string; user_id: string; workspace_id: string | null; provider: string; external_account_id: string; status: string; config_json: Json; connected_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; workspace_id?: string | null; provider: string; external_account_id?: string; status?: string; config_json?: Json; connected_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; workspace_id?: string | null; provider?: string; external_account_id?: string; status?: string; config_json?: Json; connected_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      ai_conversations: {
        Row: { id: string; workspace_id: string; user_id: string; title: string; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; user_id: string; title?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; workspace_id?: string; user_id?: string; title?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      ai_messages: {
        Row: { id: string; conversation_id: string; role: string; content_json: Json; model_used: string | null; usage_json: Json; created_at: string };
        Insert: { id?: string; conversation_id: string; role: string; content_json?: Json; model_used?: string | null; usage_json?: Json; created_at?: string };
        Update: { id?: string; conversation_id?: string; role?: string; content_json?: Json; model_used?: string | null; usage_json?: Json; created_at?: string };
        Relationships: [];
      };
      source_chunks: {
        Row: { id: string; file_source_id: string; position: number; content: string; token_count: number | null; metadata_json: Json; created_at: string };
        Insert: { id?: string; file_source_id: string; position: number; content: string; token_count?: number | null; metadata_json?: Json; created_at?: string };
        Update: { id?: string; file_source_id?: string; position?: number; content?: string; token_count?: number | null; metadata_json?: Json; created_at?: string };
        Relationships: [];
      };
      tasks: {
        Row: { id: string; user_id: string; title: string; status: string; priority: string | null; due_at: string | null; description_json: Json; position: number; completed_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; title: string; status?: string; priority?: string | null; due_at?: string | null; description_json?: Json; position?: number; completed_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; title?: string; status?: string; priority?: string | null; due_at?: string | null; description_json?: Json; position?: number; completed_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      task_subtasks: {
        Row: { id: string; task_id: string; title: string; is_done: boolean; position: number; created_at: string };
        Insert: { id?: string; task_id: string; title: string; is_done?: boolean; position?: number; created_at?: string };
        Update: { id?: string; task_id?: string; title?: string; is_done?: boolean; position?: number; created_at?: string };
        Relationships: [];
      };
      calendars: {
        Row: { id: string; user_id: string; name: string; color: string; is_visible: boolean; position: number; created_at: string };
        Insert: { id?: string; user_id: string; name: string; color?: string; is_visible?: boolean; position?: number; created_at?: string };
        Update: { id?: string; user_id?: string; name?: string; color?: string; is_visible?: boolean; position?: number; created_at?: string };
        Relationships: [];
      };
      calendar_events: {
        Row: { id: string; calendar_id: string; user_id: string; title: string; starts_at: string; ends_at: string; all_day: boolean; location: string | null; description_json: Json; task_id: string | null; google_event_id: string | null; source: string; created_at: string; updated_at: string };
        Insert: { id?: string; calendar_id: string; user_id: string; title: string; starts_at: string; ends_at: string; all_day?: boolean; location?: string | null; description_json?: Json; task_id?: string | null; google_event_id?: string | null; source?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; calendar_id?: string; user_id?: string; title?: string; starts_at?: string; ends_at?: string; all_day?: boolean; location?: string | null; description_json?: Json; task_id?: string | null; google_event_id?: string | null; source?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      workspace_links: {
        Row: { id: string; workspace_id: string; resource_type: string; resource_id: string; created_by: string; created_at: string };
        Insert: { id?: string; workspace_id: string; resource_type: string; resource_id: string; created_by: string; created_at?: string };
        Update: { id?: string; workspace_id?: string; resource_type?: string; resource_id?: string; created_by?: string; created_at?: string };
        Relationships: [];
      };
      file_links: {
        Row: { id: string; file_source_id: string; target_type: string; target_id: string; created_at: string };
        Insert: { id?: string; file_source_id: string; target_type: string; target_id: string; created_at?: string };
        Update: { id?: string; file_source_id?: string; target_type?: string; target_id?: string; created_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_planevo_workspace: {
        Args: { p_owner_id: string; p_name: string; p_icon?: string | null };
        Returns: Json;
      };
      create_starter_workspace: {
        Args: {
          p_owner_id: string;
          p_seed: Json;
          p_workspace_id?: string | null;
        };
        Returns: Json;
      };
      promote_blocks_to_records: {
        Args: {
          p_owner_id: string;
          p_page_id: string;
          p_database_id: string;
          p_blocks: Json;
          p_next_content: Json;
        };
        Returns: Json;
      };
      duplicate_database_with_records: {
        Args: { p_owner_id: string; p_database_id: string; p_name?: string | null };
        Returns: Json;
      };
      create_database_from_template: {
        Args: { p_owner_id: string; p_workspace_id: string; p_template: Json };
        Returns: Json;
      };
      create_task_database_with_views: {
        Args: { p_owner_id: string; p_workspace_id: string; p_name?: string };
        Returns: Json;
      };
      create_calendar_database_with_views: {
        Args: { p_owner_id: string; p_workspace_id: string; p_name?: string };
        Returns: Json;
      };
      create_document_page: {
        Args: { p_owner_id: string; p_workspace_id: string; p_title?: string };
        Returns: Json;
      };
      create_task_with_required_foundation: {
        Args: {
          p_owner_id: string;
          p_workspace_id?: string | null;
          p_title?: string | null;
          p_description?: string | null;
          p_status?: string | null;
          p_priority?: string | null;
          p_due_date?: string | null;
          p_estimate_minutes?: number | null;
          p_tags?: Json;
          p_attachments?: Json;
        };
        Returns: Json;
      };
      get_database_records: {
        Args: { p_database_id: string; p_limit?: number; p_offset?: number };
        Returns: {
          record_id: string;
          record_position: number;
          created_at: string;
          updated_at: string;
          values_json: Json;
        }[];
      };
      duplicate_database_structure: {
        Args: { p_owner_id: string; p_database_id: string; p_name?: string | null };
        Returns: Json;
      };
      apply_property_conversion: {
        Args: {
          p_owner_id: string;
          p_property_id: string;
          p_new_type: string;
          p_new_config: Json;
          p_value_updates: Json;
          p_clear_record_ids: string[];
        };
        Returns: Json;
      };
      duplicate_records: {
        Args: { p_owner_id: string; p_record_ids: string[] };
        Returns: string[];
      };
      move_records_to_database: {
        Args: {
          p_owner_id: string;
          p_record_ids: string[];
          p_target_database_id: string;
          p_property_map: Json;
        };
        Returns: number;
      };
      get_workspace_calendar_records: {
        Args: { p_workspace_id: string; p_start: string; p_end: string };
        Returns: {
          record_id: string;
          property_id: string;
          title: string;
          occurs_at: string;
          database_id: string;
          database_name: string;
          page_id: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
export type PageRow = Database["public"]["Tables"]["pages"]["Row"];
export type DatabaseRow = Database["public"]["Tables"]["databases"]["Row"];
export type DatabasePropertyRow =
  Database["public"]["Tables"]["database_properties"]["Row"];
export type ViewRow = Database["public"]["Tables"]["views"]["Row"];
