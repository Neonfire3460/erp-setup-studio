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
      app_settings: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      brand_suppliers: {
        Row: {
          brand_activity: string
          entity_code: string
          supplier: string
        }
        Insert: {
          brand_activity: string
          entity_code: string
          supplier: string
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
          active: boolean
          brand_activity: string
          default_unit: string | null
        }
        Insert: {
          active?: boolean
          brand_activity: string
          default_unit?: string | null
        }
        Update: {
          active?: boolean
          brand_activity?: string
          default_unit?: string | null
        }
        Relationships: []
      }
      catalogue_items: {
        Row: {
          alternate_description: string | null
          alternative_code: string | null
          approved_at: string | null
          brand_activity: string | null
          category_name: string | null
          currency: string | null
          description: string | null
          entity_code: string
          family_name: string | null
          group_name: string | null
          item_code: string
          midwich_family_name: string | null
          retail_price: number | null
          sub_activity: string | null
          sub_category_name: string | null
          submission_id: string | null
        }
        Insert: {
          alternate_description?: string | null
          alternative_code?: string | null
          approved_at?: string | null
          brand_activity?: string | null
          category_name?: string | null
          currency?: string | null
          description?: string | null
          entity_code: string
          family_name?: string | null
          group_name?: string | null
          item_code: string
          midwich_family_name?: string | null
          retail_price?: number | null
          sub_activity?: string | null
          sub_category_name?: string | null
          submission_id?: string | null
        }
        Update: {
          alternate_description?: string | null
          alternative_code?: string | null
          approved_at?: string | null
          brand_activity?: string | null
          category_name?: string | null
          currency?: string | null
          description?: string | null
          entity_code?: string
          family_name?: string | null
          group_name?: string | null
          item_code?: string
          midwich_family_name?: string | null
          retail_price?: number | null
          sub_activity?: string | null
          sub_category_name?: string | null
          submission_id?: string | null
        }
        Relationships: []
      }
      conversions: {
        Row: {
          ai_response: Json | null
          brand_activity: string | null
          created_at: string
          detected_rows: Json | null
          files: Json
          id: string
          user_id: string
        }
        Insert: {
          ai_response?: Json | null
          brand_activity?: string | null
          created_at?: string
          detected_rows?: Json | null
          files?: Json
          id?: string
          user_id?: string
        }
        Update: {
          ai_response?: Json | null
          brand_activity?: string | null
          created_at?: string
          detected_rows?: Json | null
          files?: Json
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          active: boolean
          code: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          name?: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      description_examples: {
        Row: {
          brand_activity: string | null
          created_at: string
          final: string | null
          id: string
          item_code: string | null
          original: string | null
        }
        Insert: {
          brand_activity?: string | null
          created_at?: string
          final?: string | null
          id?: string
          item_code?: string | null
          original?: string | null
        }
        Update: {
          brand_activity?: string | null
          created_at?: string
          final?: string | null
          id?: string
          item_code?: string | null
          original?: string | null
        }
        Relationships: []
      }
      entities: {
        Row: {
          active: boolean
          code: string
          currency: string
          name: string
          region: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          currency: string
          name: string
          region: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          currency?: string
          name?: string
          region?: string
          sort_order?: number
        }
        Relationships: []
      }
      erp_imports: {
        Row: {
          active: boolean
          entity_code: string
          file_name: string | null
          id: string
          imported_at: string
          imported_by: string | null
          row_count: number
        }
        Insert: {
          active?: boolean
          entity_code: string
          file_name?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          row_count?: number
        }
        Update: {
          active?: boolean
          entity_code?: string
          file_name?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          row_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "erp_imports_entity_code_fkey"
            columns: ["entity_code"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["code"]
          },
        ]
      }
      erp_items: {
        Row: {
          alternative_code: string | null
          alternative_description: string | null
          b2b: number | null
          brand_activity: string | null
          category_code: string | null
          category_name: string | null
          description: string | null
          entity_code: string
          family_code: string | null
          family_name: string | null
          group_code: string | null
          group_name: string | null
          import_id: string
          inactive: number | null
          item_code: string
          max_discount_pct: number | null
          measurement_unit: string | null
          midwich_family_code: string | null
          midwich_family_name: string | null
          refreshed_at: string
          retail_price: number | null
          sub_activity: string | null
          sub_category_code: string | null
          sub_category_name: string | null
          supplier_code: string | null
          webactive: number | null
        }
        Insert: {
          alternative_code?: string | null
          alternative_description?: string | null
          b2b?: number | null
          brand_activity?: string | null
          category_code?: string | null
          category_name?: string | null
          description?: string | null
          entity_code: string
          family_code?: string | null
          family_name?: string | null
          group_code?: string | null
          group_name?: string | null
          import_id: string
          inactive?: number | null
          item_code: string
          max_discount_pct?: number | null
          measurement_unit?: string | null
          midwich_family_code?: string | null
          midwich_family_name?: string | null
          refreshed_at?: string
          retail_price?: number | null
          sub_activity?: string | null
          sub_category_code?: string | null
          sub_category_name?: string | null
          supplier_code?: string | null
          webactive?: number | null
        }
        Update: {
          alternative_code?: string | null
          alternative_description?: string | null
          b2b?: number | null
          brand_activity?: string | null
          category_code?: string | null
          category_name?: string | null
          description?: string | null
          entity_code?: string
          family_code?: string | null
          family_name?: string | null
          group_code?: string | null
          group_name?: string | null
          import_id?: string
          inactive?: number | null
          item_code?: string
          max_discount_pct?: number | null
          measurement_unit?: string | null
          midwich_family_code?: string | null
          midwich_family_name?: string | null
          refreshed_at?: string
          retail_price?: number | null
          sub_activity?: string | null
          sub_category_code?: string | null
          sub_category_name?: string | null
          supplier_code?: string | null
          webactive?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_items_entity_code_fkey"
            columns: ["entity_code"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "erp_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "erp_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          entity_code: string
          from_currency: string
          rate: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          entity_code: string
          from_currency: string
          rate: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          entity_code?: string
          from_currency?: string
          rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_entity_code_fkey"
            columns: ["entity_code"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "exchange_rates_from_currency_fkey"
            columns: ["from_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      mapping_corrections: {
        Row: {
          ai_value: string | null
          brand_activity: string | null
          created_at: string
          field: string | null
          headers: Json | null
          id: string
          user_value: string | null
        }
        Insert: {
          ai_value?: string | null
          brand_activity?: string | null
          created_at?: string
          field?: string | null
          headers?: Json | null
          id?: string
          user_value?: string | null
        }
        Update: {
          ai_value?: string | null
          brand_activity?: string | null
          created_at?: string
          field?: string | null
          headers?: Json | null
          id?: string
          user_value?: string | null
        }
        Relationships: []
      }
      output_rows: {
        Row: {
          checks: Json | null
          current_erp_retail: number | null
          entity_code: string
          id: string
          names: Json | null
          row_no: number
          submission_id: string
          values: Json
        }
        Insert: {
          checks?: Json | null
          current_erp_retail?: number | null
          entity_code: string
          id?: string
          names?: Json | null
          row_no: number
          submission_id: string
          values: Json
        }
        Update: {
          checks?: Json | null
          current_erp_retail?: number | null
          entity_code?: string
          id?: string
          names?: Json | null
          row_no?: number
          submission_id?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "output_rows_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          active: boolean
          brand_activity: string
          compare_with_msrp: boolean
          entity_code: string
          id: string
          margin_divisors: number[]
          max_discount_pct: number | null
          method: string
          overhead_pct: number
          round_to: number
          source_entity: string | null
          sub_activity: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          brand_activity: string
          compare_with_msrp?: boolean
          entity_code: string
          id?: string
          margin_divisors?: number[]
          max_discount_pct?: number | null
          method?: string
          overhead_pct?: number
          round_to?: number
          source_entity?: string | null
          sub_activity?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          brand_activity?: string
          compare_with_msrp?: boolean
          entity_code?: string
          id?: string
          margin_divisors?: number[]
          max_discount_pct?: number | null
          method?: string
          overhead_pct?: number
          round_to?: number
          source_entity?: string | null
          sub_activity?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_brand_activity_fkey"
            columns: ["brand_activity"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["brand_activity"]
          },
          {
            foreignKeyName: "pricing_rules_entity_code_fkey"
            columns: ["entity_code"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["code"]
          },
        ]
      }
      sub_activities: {
        Row: {
          active: boolean
          brand_activity: string
          sub_activity: string
        }
        Insert: {
          active?: boolean
          brand_activity: string
          sub_activity: string
        }
        Update: {
          active?: boolean
          brand_activity?: string
          sub_activity?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_activities_brand_activity_fkey"
            columns: ["brand_activity"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["brand_activity"]
          },
        ]
      }
      submission_rows: {
        Row: {
          alternate_description: string | null
          alternative_code: string | null
          brand_activity: string | null
          checks: Json | null
          cost_currency: string
          cost_price: number | null
          description: string | null
          entity_code: string
          id: string
          item_code: string
          measurement_unit: string | null
          row_no: number
          sub_activity: string | null
          submission_id: string
          vendor_msrp: number | null
        }
        Insert: {
          alternate_description?: string | null
          alternative_code?: string | null
          brand_activity?: string | null
          checks?: Json | null
          cost_currency: string
          cost_price?: number | null
          description?: string | null
          entity_code: string
          id?: string
          item_code: string
          measurement_unit?: string | null
          row_no: number
          sub_activity?: string | null
          submission_id: string
          vendor_msrp?: number | null
        }
        Update: {
          alternate_description?: string | null
          alternative_code?: string | null
          brand_activity?: string | null
          checks?: Json | null
          cost_currency?: string
          cost_price?: number | null
          description?: string | null
          entity_code?: string
          id?: string
          item_code?: string
          measurement_unit?: string | null
          row_no?: number
          sub_activity?: string | null
          submission_id?: string
          vendor_msrp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "submission_rows_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          brand_activity: string
          conversion_id: string | null
          counts: Json | null
          created_at: string
          entities: Json
          file_path: string | null
          id: string
          output_path: string | null
          processing_revision: number
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          brand_activity: string
          conversion_id?: string | null
          counts?: Json | null
          created_at?: string
          entities?: Json
          file_path?: string | null
          id?: string
          output_path?: string | null
          processing_revision?: number
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source: string
          status?: string
          submitted_at?: string | null
          user_id?: string
        }
        Update: {
          brand_activity?: string
          conversion_id?: string | null
          counts?: Json | null
          created_at?: string
          entities?: Json
          file_path?: string | null
          id?: string
          output_path?: string | null
          processing_revision?: number
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_conversion_id_fkey"
            columns: ["conversion_id"]
            isOneToOne: false
            referencedRelation: "conversions"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          brand_activity: string | null
          created_at: string
          currency: string | null
          entity_code: string | null
          id: string
          kind: string
          note: string | null
          resolved_at: string | null
          resolved_by: string | null
          row_count: number
          status: string
          sub_activity: string | null
          submission_id: string | null
        }
        Insert: {
          brand_activity?: string | null
          created_at?: string
          currency?: string | null
          entity_code?: string | null
          id?: string
          kind: string
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          row_count?: number
          status?: string
          sub_activity?: string | null
          submission_id?: string | null
        }
        Update: {
          brand_activity?: string | null
          created_at?: string
          currency?: string | null
          entity_code?: string | null
          id?: string
          kind?: string
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          row_count?: number
          status?: string
          sub_activity?: string | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
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
          times_used: number
        }
        Insert: {
          brand_activity: string
          created_by?: string | null
          header_signature: string
          id?: string
          last_used_at?: string
          mapping: Json
          times_used?: number
        }
        Update: {
          brand_activity?: string
          created_by?: string | null
          header_signature?: string
          id?: string
          last_used_at?: string
          mapping?: Json
          times_used?: number
        }
        Relationships: []
      }
    }
    Views: {
      erp_items_active: {
        Row: {
          alternative_code: string | null
          alternative_description: string | null
          b2b: number | null
          brand_activity: string | null
          category_code: string | null
          category_name: string | null
          description: string | null
          entity_code: string | null
          family_code: string | null
          family_name: string | null
          group_code: string | null
          group_name: string | null
          import_id: string | null
          inactive: number | null
          item_code: string | null
          max_discount_pct: number | null
          measurement_unit: string | null
          midwich_family_code: string | null
          midwich_family_name: string | null
          refreshed_at: string | null
          retail_price: number | null
          sub_activity: string | null
          sub_category_code: string | null
          sub_category_name: string | null
          supplier_code: string | null
          webactive: number | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_items_entity_code_fkey"
            columns: ["entity_code"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "erp_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "erp_imports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_erp_import: { Args: { _import_id: string }; Returns: number }
      active_erp_for_codes: {
        Args: { _codes: string[] }
        Returns: {
          alternative_code: string | null
          alternative_description: string | null
          b2b: number | null
          brand_activity: string | null
          category_code: string | null
          category_name: string | null
          description: string | null
          entity_code: string
          family_code: string | null
          family_name: string | null
          group_code: string | null
          group_name: string | null
          import_id: string
          inactive: number | null
          item_code: string
          max_discount_pct: number | null
          measurement_unit: string | null
          midwich_family_code: string | null
          midwich_family_name: string | null
          refreshed_at: string
          retail_price: number | null
          sub_activity: string | null
          sub_category_code: string | null
          sub_category_name: string | null
          supplier_code: string | null
          webactive: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "erp_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      approve_submission: {
        Args: { _actor: string; _id: string; _path: string; _revision: number }
        Returns: undefined
      }
      create_build_submission: {
        Args: {
          _brand: string
          _entities: Json
          _path: string
          _rows: Json
          _user: string
        }
        Returns: string
      }
      delete_erp_import_rows: { Args: { _import_id: string }; Returns: number }
      erp_check: {
        Args: { codes: string[] }
        Returns: {
          code: string
          description: string
          in_erp: boolean
        }[]
      }
      erp_entity_stats: {
        Args: never
        Returns: {
          active_count: number
          entity_code: string
          row_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_brands: {
        Args: never
        Returns: {
          brand_activity: string
          default_unit: string
          sub_activities: string[]
        }[]
      }
      persist_submission_processing: {
        Args: {
          _counts: Json
          _id: string
          _outputs: Json
          _revision: number
          _status: string
          _tickets: Json
        }
        Returns: number
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
