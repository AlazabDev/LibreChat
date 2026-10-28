export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      az_agent_profiles: {
        Row: {
          connection_id: string | null
          created_at: string
          enabled: boolean
          id: string
          instructions: string
          model_ref_id: string | null
          name: string
          owner_id: string
          provider: string
          settings: Json
          slug: string
          target: string
          tools: string[]
          updated_at: string
          version: string | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          instructions?: string
          model_ref_id?: string | null
          name: string
          owner_id: string
          provider: string
          settings?: Json
          slug: string
          target?: string
          tools?: string[]
          updated_at?: string
          version?: string | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          instructions?: string
          model_ref_id?: string | null
          name?: string
          owner_id?: string
          provider?: string
          settings?: Json
          slug?: string
          target?: string
          tools?: string[]
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "az_agent_profiles_connection_owner_fk"
            columns: ["connection_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "az_provider_connections"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "az_agent_profiles_model_owner_fk"
            columns: ["model_ref_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "az_provider_models"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      az_agent_tool_bindings: {
        Row: {
          agent_id: string
          config: Json
          created_at: string
          enabled: boolean
          owner_id: string
          tool_id: string
        }
        Insert: {
          agent_id: string
          config?: Json
          created_at?: string
          enabled?: boolean
          owner_id: string
          tool_id: string
        }
        Update: {
          agent_id?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          owner_id?: string
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "az_agent_tool_bindings_agent_id_owner_id_fkey"
            columns: ["agent_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "az_agent_profiles"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "az_agent_tool_bindings_tool_id_owner_id_fkey"
            columns: ["tool_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "az_tool_registry"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      az_execution_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          run_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          owner_id: string
          payload?: Json
          run_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          owner_id?: string
          payload?: Json
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "az_execution_events_run_id_owner_id_fkey"
            columns: ["run_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "az_execution_runs"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      az_execution_runs: {
        Row: {
          agent_id: string | null
          connection_id: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          metadata: Json
          model_id: string | null
          owner_id: string
          provider: string
          started_at: string
          status: string
          thread_id: string
        }
        Insert: {
          agent_id?: string | null
          connection_id?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          model_id?: string | null
          owner_id: string
          provider: string
          started_at?: string
          status?: string
          thread_id: string
        }
        Update: {
          agent_id?: string | null
          connection_id?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          model_id?: string | null
          owner_id?: string
          provider?: string
          started_at?: string
          status?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "az_execution_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "az_agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "az_execution_runs_agent_owner_fk"
            columns: ["agent_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "az_agent_profiles"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "az_execution_runs_connection_owner_fk"
            columns: ["connection_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "az_provider_connections"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "az_execution_runs_thread_owner_fk"
            columns: ["thread_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      az_provider_connections: {
        Row: {
          auth_method: string
          created_at: string
          credential_ref: string | null
          display_name: string
          enabled: boolean
          endpoint: string | null
          id: string
          owner_id: string
          provider: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          auth_method?: string
          created_at?: string
          credential_ref?: string | null
          display_name: string
          enabled?: boolean
          endpoint?: string | null
          id?: string
          owner_id: string
          provider: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          auth_method?: string
          created_at?: string
          credential_ref?: string | null
          display_name?: string
          enabled?: boolean
          endpoint?: string | null
          id?: string
          owner_id?: string
          provider?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      az_provider_models: {
        Row: {
          capabilities: Json
          connection_id: string
          discovered_at: string | null
          display_name: string | null
          enabled: boolean
          id: string
          model_id: string
          owner_id: string
        }
        Insert: {
          capabilities?: Json
          connection_id: string
          discovered_at?: string | null
          display_name?: string | null
          enabled?: boolean
          id?: string
          model_id: string
          owner_id: string
        }
        Update: {
          capabilities?: Json
          connection_id?: string
          discovered_at?: string | null
          display_name?: string | null
          enabled?: boolean
          id?: string
          model_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "az_provider_models_connection_id_owner_id_fkey"
            columns: ["connection_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "az_provider_connections"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      az_tool_calls: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          result: Json | null
          run_id: string
          status: string
          tool_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          result?: Json | null
          run_id: string
          status?: string
          tool_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          result?: Json | null
          run_id?: string
          status?: string
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "az_tool_calls_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "az_execution_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "az_tool_calls_run_owner_fk"
            columns: ["run_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "az_execution_runs"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      az_tool_registry: {
        Row: {
          config: Json
          created_at: string
          display_name: string
          enabled: boolean
          endpoint: string | null
          id: string
          kind: string
          owner_id: string
          slug: string
          transport: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          display_name: string
          enabled?: boolean
          endpoint?: string | null
          id?: string
          kind: string
          owner_id: string
          slug: string
          transport?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          display_name?: string
          enabled?: boolean
          endpoint?: string | null
          id?: string
          kind?: string
          owner_id?: string
          slug?: string
          transport?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          sdk_id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts?: Json
          role: string
          sdk_id: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          sdk_id?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_owner_fk"
            columns: ["thread_id", "user_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      thread_attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          media_type: string
          object_path: string
          size_bytes: number
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          media_type: string
          object_path: string
          size_bytes: number
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          media_type?: string
          object_path?: string
          size_bytes?: number
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_attachments_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_attachments_thread_owner_fk"
            columns: ["thread_id", "user_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      threads: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
