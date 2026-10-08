export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string;
          file_name: string;
          id: string;
          mime_type: string | null;
          request_id: string;
          size_bytes: number;
          storage_path: string;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          file_name: string;
          id?: string;
          mime_type?: string | null;
          request_id: string;
          size_bytes: number;
          storage_path: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          id?: string;
          mime_type?: string | null;
          request_id?: string;
          size_bytes?: number;
          storage_path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attachments_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json;
          entity: string;
          entity_id: string | null;
          id: string;
          organization_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          entity: string;
          entity_id?: string | null;
          id?: string;
          organization_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          entity?: string;
          entity_id?: string | null;
          id?: string;
          organization_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      departments: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          message: string;
          request_id: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message: string;
          request_id?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message?: string;
          request_id?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          address: string | null;
          allow_requester_close: boolean;
          created_at: string;
          default_sla_hours: number;
          due_soon_hours: number;
          email: string | null;
          id: string;
          legal_name: string | null;
          logo_url: string | null;
          name: string;
          phone: string | null;
          tax_id: string | null;
          timezone: string;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          allow_requester_close?: boolean;
          created_at?: string;
          default_sla_hours?: number;
          due_soon_hours?: number;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          logo_url?: string | null;
          name: string;
          phone?: string | null;
          tax_id?: string | null;
          timezone?: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          allow_requester_close?: boolean;
          created_at?: string;
          default_sla_hours?: number;
          due_soon_hours?: number;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          logo_url?: string | null;
          name?: string;
          phone?: string | null;
          tax_id?: string | null;
          timezone?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      priority_settings: {
        Row: {
          label: string;
          organization_id: string;
          priority: Database["public"]["Enums"]["request_priority"];
          sla_hours: number;
        };
        Insert: {
          label: string;
          organization_id: string;
          priority: Database["public"]["Enums"]["request_priority"];
          sla_hours: number;
        };
        Update: {
          label?: string;
          organization_id?: string;
          priority?: Database["public"]["Enums"]["request_priority"];
          sla_hours?: number;
        };
        Relationships: [
          {
            foreignKeyName: "priority_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          department_id: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          last_login_at: string | null;
          organization_id: string;
          phone: string | null;
          position: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          department_id?: string | null;
          email: string;
          full_name?: string;
          id: string;
          is_active?: boolean;
          last_login_at?: string | null;
          organization_id: string;
          phone?: string | null;
          position?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          department_id?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          last_login_at?: string | null;
          organization_id?: string;
          phone?: string | null;
          position?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      request_comments: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          is_action: boolean;
          request_id: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          is_action?: boolean;
          request_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          is_action?: boolean;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_comments_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      request_counters: {
        Row: {
          last_number: number;
          organization_id: string;
        };
        Insert: {
          last_number?: number;
          organization_id: string;
        };
        Update: {
          last_number?: number;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_counters_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      request_status_history: {
        Row: {
          action: string;
          actor_id: string | null;
          comment: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["request_status"] | null;
          id: string;
          request_id: string;
          to_status: Database["public"]["Enums"]["request_status"] | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          comment?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["request_status"] | null;
          id?: string;
          request_id: string;
          to_status?: Database["public"]["Enums"]["request_status"] | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          comment?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["request_status"] | null;
          id?: string;
          request_id?: string;
          to_status?: Database["public"]["Enums"]["request_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "request_status_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_status_history_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      request_types: {
        Row: {
          created_at: string;
          default_department_id: string | null;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          organization_id: string;
          sla_hours: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          default_department_id?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          organization_id: string;
          sla_hours?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_department_id?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          organization_id?: string;
          sla_hours?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_types_default_department_id_fkey";
            columns: ["default_department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_types_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      requests: {
        Row: {
          assigned_at: string | null;
          assigned_by: string | null;
          assignee_id: string | null;
          cancelled_at: string | null;
          closed_at: string | null;
          code: string;
          created_at: string;
          department_id: string;
          description: string;
          due_at: string;
          id: string;
          organization_id: string;
          priority: Database["public"]["Enums"]["request_priority"];
          request_type_id: string;
          requester_id: string;
          resolution_notes: string | null;
          resolved_at: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["request_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_at?: string | null;
          assigned_by?: string | null;
          assignee_id?: string | null;
          cancelled_at?: string | null;
          closed_at?: string | null;
          code: string;
          created_at?: string;
          department_id: string;
          description: string;
          due_at: string;
          id?: string;
          organization_id: string;
          priority?: Database["public"]["Enums"]["request_priority"];
          request_type_id: string;
          requester_id: string;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_at?: string | null;
          assigned_by?: string | null;
          assignee_id?: string | null;
          cancelled_at?: string | null;
          closed_at?: string | null;
          code?: string;
          created_at?: string;
          department_id?: string;
          description?: string;
          due_at?: string;
          id?: string;
          organization_id?: string;
          priority?: Database["public"]["Enums"]["request_priority"];
          request_type_id?: string;
          requester_id?: string;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "requests_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_request_type_id_fkey";
            columns: ["request_type_id"];
            isOneToOne: false;
            referencedRelation: "request_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _audit: {
        Args: {
          _action: string;
          _details: Json;
          _entity: string;
          _entity_id: string;
          _org: string;
        };
        Returns: undefined;
      };
      _notify: {
        Args: {
          _message: string;
          _request: string;
          _title: string;
          _type: string;
          _user: string;
        };
        Returns: undefined;
      };
      add_request_comment: {
        Args: { _body: string; _is_action?: boolean; _request_id: string };
        Returns: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          is_action: boolean;
          request_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "request_comments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      assign_request: {
        Args: { _assignee_id: string; _comment?: string; _request_id: string };
        Returns: {
          assigned_at: string | null;
          assigned_by: string | null;
          assignee_id: string | null;
          cancelled_at: string | null;
          closed_at: string | null;
          code: string;
          created_at: string;
          department_id: string;
          description: string;
          due_at: string;
          id: string;
          organization_id: string;
          priority: Database["public"]["Enums"]["request_priority"];
          request_type_id: string;
          requester_id: string;
          resolution_notes: string | null;
          resolved_at: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["request_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      can_access_request: { Args: { _request_id: string }; Returns: boolean };
      change_request_priority: {
        Args: {
          _priority: Database["public"]["Enums"]["request_priority"];
          _request_id: string;
        };
        Returns: {
          assigned_at: string | null;
          assigned_by: string | null;
          assignee_id: string | null;
          cancelled_at: string | null;
          closed_at: string | null;
          code: string;
          created_at: string;
          department_id: string;
          description: string;
          due_at: string;
          id: string;
          organization_id: string;
          priority: Database["public"]["Enums"]["request_priority"];
          request_type_id: string;
          requester_id: string;
          resolution_notes: string | null;
          resolved_at: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["request_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      change_request_status: {
        Args: {
          _comment?: string;
          _new_status: Database["public"]["Enums"]["request_status"];
          _request_id: string;
        };
        Returns: {
          assigned_at: string | null;
          assigned_by: string | null;
          assignee_id: string | null;
          cancelled_at: string | null;
          closed_at: string | null;
          code: string;
          created_at: string;
          department_id: string;
          description: string;
          due_at: string;
          id: string;
          organization_id: string;
          priority: Database["public"]["Enums"]["request_priority"];
          request_type_id: string;
          requester_id: string;
          resolution_notes: string | null;
          resolved_at: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["request_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_request: {
        Args: {
          _department_id: string;
          _description: string;
          _due_at?: string;
          _priority: Database["public"]["Enums"]["request_priority"];
          _request_type_id: string;
          _title: string;
        };
        Returns: {
          assigned_at: string | null;
          assigned_by: string | null;
          assignee_id: string | null;
          cancelled_at: string | null;
          closed_at: string | null;
          code: string;
          created_at: string;
          department_id: string;
          description: string;
          due_at: string;
          id: string;
          organization_id: string;
          priority: Database["public"]["Enums"]["request_priority"];
          request_type_id: string;
          requester_id: string;
          resolution_notes: string | null;
          resolved_at: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["request_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_org_id: { Args: never; Returns: string };
      dashboard_stats: { Args: { _from?: string; _to?: string }; Returns: Json };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_org_admin: { Args: never; Returns: boolean };
      log_event: {
        Args: { _action: string; _details?: Json };
        Returns: undefined;
      };
      refresh_due_alerts: { Args: never; Returns: number };
      status_label: {
        Args: { _s: Database["public"]["Enums"]["request_status"] };
        Returns: string;
      };
      update_request_due: {
        Args: { _due_at: string; _request_id: string };
        Returns: {
          assigned_at: string | null;
          assigned_by: string | null;
          assignee_id: string | null;
          cancelled_at: string | null;
          closed_at: string | null;
          code: string;
          created_at: string;
          department_id: string;
          description: string;
          due_at: string;
          id: string;
          organization_id: string;
          priority: Database["public"]["Enums"]["request_priority"];
          request_type_id: string;
          requester_id: string;
          resolution_notes: string | null;
          resolved_at: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["request_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      app_role: "admin" | "responsable" | "empleado";
      request_priority: "baja" | "media" | "alta" | "critica";
      request_status:
        "pendiente" | "asignada" | "en_proceso" | "resuelta" | "cerrada" | "cancelada";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "responsable", "empleado"],
      request_priority: ["baja", "media", "alta", "critica"],
      request_status: ["pendiente", "asignada", "en_proceso", "resuelta", "cerrada", "cancelada"],
    },
  },
} as const;
