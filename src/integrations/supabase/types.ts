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
      brand_suppliers: {
        Row: {
          brand_activity: string
          entity_code: string
          supplier: string
        }
        Insert: {
          brand_activity: string
          entity_code: string
          supplier?: string
        }
        Update: {
          brand_activity?: string
          entity_code?: string
          supplier?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_suppliers_brand_activity_fkey"
            columns: ["brand_activity"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["brand_activity"]
          },
          {
            foreignKeyName: "brand_suppliers_entity_code_fkey"
            columns: ["entity_code"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["code"]
          },
        ]
      }
      brands: {
        Row: {
          brand_activity: string
          default_unit: string | null
          supplier: string
        }
        Insert: {
          brand_activity: string
          default_unit?: string | null
          supplier?: string
        }
        Update: {
          brand_activity?: string
          default_unit?: string | null
          supplier?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          code: string
          currency: string
          name: string
          region: string
          sort_order: number
        }
        Insert: {
          code: string
          currency: string
          name: string
          region: string
          sort_order?: number
        }
        Update: {
          code?: string
          currency?: string
          name?: string
          region?: string
          sort_order?: number
        }
        Relationships: []
      }
      erp_items: {
        Row: {
          b2b: string | null
          category_name: string | null
          family_name: string | null
          group_name: string | null
          inactive: string | null
          item_code: string
          measurement_unit: string | null
          midwich_family: string | null
          refreshed_at: string
          sub_category_name: string | null
          webactive: string | null
        }
        Insert: {
          b2b?: string | null
          category_name?: string | null
          family_name?: string | null
          group_name?: string | null
          inactive?: string | null
          item_code: string
          measurement_unit?: string | null
          midwich_family?: string | null
          refreshed_at?: string
          sub_category_name?: string | null
          webactive?: string | null
        }
        Update: {
          b2b?: string | null
          category_name?: string | null
          family_name?: string | null
          group_name?: string | null
          inactive?: string | null
          item_code?: string
          measurement_unit?: string | null
          midwich_family?: string | null
          refreshed_at?: string
          sub_category_name?: string | null
          webactive?: string | null
        }
        Relationships: []
      }
      erp_items_staging: {
        Row: {
          b2b: string | null
          batch_id: string
          category_name: string | null
          created_by: string
          family_name: string | null
          group_name: string | null
          inactive: string | null
          item_code: string
          measurement_unit: string | null
          midwich_family: string | null
          refreshed_at: string
          sub_category_name: string | null
          webactive: string | null
        }
        Insert: {
          b2b?: string | null
          batch_id: string
          category_name?: string | null
          created_by?: string
          family_name?: string | null
          group_name?: string | null
          inactive?: string | null
          item_code: string
          measurement_unit?: string | null
          midwich_family?: string | null
          refreshed_at?: string
          sub_category_name?: string | null
          webactive?: string | null
        }
        Update: {
          b2b?: string | null
          batch_id?: string
          category_name?: string | null
          created_by?: string
          family_name?: string | null
          group_name?: string | null
          inactive?: string | null
          item_code?: string
          measurement_unit?: string | null
          midwich_family?: string | null
          refreshed_at?: string
          sub_category_name?: string | null
          webactive?: string | null
        }
        Relationships: []
      }
      export_audit: {
        Row: {
          export_id: string
          rule_snapshot: Json
        }
        Insert: {
          export_id: string
          rule_snapshot: Json
        }
        Update: {
          export_id?: string
          rule_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "export_audit_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: true
            referencedRelation: "exports"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          created_at: string
          entity_code: string
          id: string
          row_count: number
          rows: Json | null
          upload_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_code: string
          id?: string
          row_count?: number
          rows?: Json | null
          upload_id?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          entity_code?: string
          id?: string
          row_count?: number
          rows?: Json | null
          upload_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rule_entities: {
        Row: {
          cost_basis: string
          entity_code: string
          ex_rate: number
          overhead_pct: number
          retail_method: string
          round_to: number
          rule_id: string
        }
        Insert: {
          cost_basis?: string
          entity_code: string
          ex_rate: number
          overhead_pct?: number
          retail_method?: string
          round_to?: number
          rule_id: string
        }
        Update: {
          cost_basis?: string
          entity_code?: string
          ex_rate?: number
          overhead_pct?: number
          retail_method?: string
          round_to?: number
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rule_entities_entity_code_fkey"
            columns: ["entity_code"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "pricing_rule_entities_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "pricing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          active: boolean
          brand_activity: string
          cost_method: string
          discount_pct: number
          id: string
          is_test: boolean
          margin_divisors: number[]
          max_discount_pct: number | null
          sub_activity: string
          updated_at: string
          updated_by: string | null
          vendor_currency: string
        }
        Insert: {
          active?: boolean
          brand_activity: string
          cost_method: string
          discount_pct?: number
          id?: string
          is_test?: boolean
          margin_divisors: number[]
          max_discount_pct?: number | null
          sub_activity: string
          updated_at?: string
          updated_by?: string | null
          vendor_currency: string
        }
        Update: {
          active?: boolean
          brand_activity?: string
          cost_method?: string
          discount_pct?: number
          id?: string
          is_test?: boolean
          margin_divisors?: number[]
          max_discount_pct?: number | null
          sub_activity?: string
          updated_at?: string
          updated_by?: string | null
          vendor_currency?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          ai_response: Json | null
          brand_activity: string | null
          counts: Json | null
          created_at: string
          detected_rows: Json | null
          file_name: string | null
          file_path: string | null
          id: string
          mapping: Json | null
          tool: string
          user_id: string
          vendor_currency: string | null
        }
        Insert: {
          ai_response?: Json | null
          brand_activity?: string | null
          counts?: Json | null
          created_at?: string
          detected_rows?: Json | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          mapping?: Json | null
          tool: string
          user_id?: string
          vendor_currency?: string | null
        }
        Update: {
          ai_response?: Json | null
          brand_activity?: string | null
          counts?: Json | null
          created_at?: string
          detected_rows?: Json | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          mapping?: Json | null
          tool?: string
          user_id?: string
          vendor_currency?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_profiles: {
        Row: {
          brand_activity: string
          created_by: string | null
          header_signature: string
          id: string
          last_used_at: string
          mapping: Json
        }
        Insert: {
          brand_activity: string
          created_by?: string | null
          header_signature: string
          id?: string
          last_used_at?: string
          mapping: Json
        }
        Update: {
          brand_activity?: string
          created_by?: string | null
          header_signature?: string
          id?: string
          last_used_at?: string
          mapping?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      admin_set_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      count_erp_matches: { Args: { codes: string[] }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_activities: {
        Args: never
        Returns: {
          brand_activity: string
          cost_method: string
          entity_codes: string[]
          sub_activity: string
          vendor_currency: string
        }[]
      }
      replace_erp_items: {
        Args: { _batch_id: string; _expected_count: number }
        Returns: number
      }
      save_erp_export: {
        Args: {
          _entity_code: string
          _rows: Json
          _snapshot: Json
          _upload_id: string
          _user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
