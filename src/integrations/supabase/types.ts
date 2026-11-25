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
      ai_description_examples: {
        Row: {
          ai_description: string
          brand_activity: string
          created_at: string
          erp_description: string
          final_description: string
          id: number
          item_code: string
          user_id: string | null
          vendor_description: string
        }
        Insert: {
          ai_description?: string
          brand_activity: string
          created_at?: string
          erp_description?: string
          final_description: string
          id?: number
          item_code: string
          user_id?: string | null
          vendor_description?: string
        }
        Update: {
          ai_description?: string
          brand_activity?: string
          created_at?: string
          erp_description?: string
          final_description?: string
          id?: number
          item_code?: string
          user_id?: string | null
          vendor_description?: string
        }
        Relationships: []
      }
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
      approved_prices: {
        Row: {
          approved_at: string
          brand_activity: string
          currency: string | null
          description: string | null
          entity_code: string
          inactive: number | null
          item_code: string
          retail_price: number | null
          ticket_id: string | null
        }
        Insert: {
          approved_at?: string
          brand_activity: string
          currency?: string | null
          description?: string | null
          entity_code: string
          inactive?: number | null
          item_code: string
          retail_price?: number | null
          ticket_id?: string | null
        }
        Update: {
          approved_at?: string
          brand_activity?: string
          currency?: string | null
          description?: string | null
          entity_code?: string
          inactive?: number | null
          item_code?: string
          retail_price?: number | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approved_prices_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ir_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_ai_profiles: {
        Row: {
          brand_activity: string
          header_signature: string
          id: string
          profile: Json
          times_used: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand_activity: string
          header_signature: string
          id?: string
          profile: Json
          times_used?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand_activity?: string
          header_signature?: string
          id?: string
          profile?: Json
          times_used?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      brand_suppliers: {
        Row: {
          brand_activity: string
          entity_code: string
          supplier: string
          supplier_name: string
        }
        Insert: {
          brand_activity: string
          entity_code: string
          supplier: string
          supplier_name?: string
        }
        Update: {
          brand_activity?: string
          entity_code?: string
          supplier?: string
          supplier_name?: string
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
          default_max_discount: number | null
          default_unit: string | null
          entity_codes: string[]
          last_currency: string | null
          logo_path: string | null
        }
        Insert: {
          active?: boolean
          brand_activity: string
          default_max_discount?: number | null
          default_unit?: string | null
          entity_codes?: string[]
          last_currency?: string | null
          logo_path?: string | null
        }
        Update: {
          active?: boolean
          brand_activity?: string
          default_max_discount?: number | null
          default_unit?: string | null
          entity_codes?: string[]
          last_currency?: string | null
          logo_path?: string | null
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
      categories: {
        Row: {
          active: boolean
          category_code: string
          category_name: string
          family_code: string
          family_name: string
          group_code: string
          group_name: string
          midwich_code: string
          review_note: string
          sub_category_code: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_code: string
          category_name: string
          family_code: string
          family_name: string
          group_code: string
          group_name: string
          midwich_code?: string
          review_note?: string
          sub_category_code: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_code?: string
          category_name?: string
          family_code?: string
          family_name?: string
          group_code?: string
          group_name?: string
          midwich_code?: string
          review_note?: string
          sub_category_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      change_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          new_row: Json | null
          old_row: Json | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: number
          new_row?: Json | null
          old_row?: Json | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: number
          new_row?: Json | null
          old_row?: Json | null
          table_name?: string
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
      email_log: {
        Row: {
          created_at: string
          error: string | null
          id: number
          kind: string
          real_to: string | null
          status: string
          subject: string
          ticket_id: string | null
          to_address: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: number
          kind: string
          real_to?: string | null
          status: string
          subject: string
          ticket_id?: string | null
          to_address: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: number
          kind?: string
          real_to?: string | null
          status?: string
          subject?: string
          ticket_id?: string | null
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ir_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          active: boolean
          code: string
          currency: string
          is_master: boolean
          legal_name: string
          name: string
          pdf_allowed: boolean
          pdf_logo_path: string | null
          pdf_terms_line: string
          region: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          currency: string
          is_master?: boolean
          legal_name?: string
          name: string
          pdf_allowed?: boolean
          pdf_logo_path?: string | null
          pdf_terms_line?: string
          region: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          currency?: string
          is_master?: boolean
          legal_name?: string
          name?: string
          pdf_allowed?: boolean
          pdf_logo_path?: string | null
          pdf_terms_line?: string
          region?: string
          sort_order?: number
        }
        Relationships: []
      }
      erp_imports: {
        Row: {
          active: boolean
          brands: string[]
          counts: Json | null
          entity_code: string
          file_name: string | null
          id: string
          imported_at: string
          imported_by: string | null
          mode: string
          row_count: number
        }
        Insert: {
          active?: boolean
          brands?: string[]
          counts?: Json | null
          entity_code: string
          file_name?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          mode?: string
          row_count?: number
        }
        Update: {
          active?: boolean
          brands?: string[]
          counts?: Json | null
          entity_code?: string
          file_name?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          mode?: string
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
          cost_currency: string | null
          cost_price: number | null
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
          cost_currency?: string | null
          cost_price?: number | null
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
          cost_currency?: string | null
          cost_price?: number | null
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
      fx_rates: {
        Row: {
          from_currency: string
          rate: number
          to_currency: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          from_currency: string
          rate: number
          to_currency: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          from_currency?: string
          rate?: number
          to_currency?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fx_rates_from_currency_fkey"
            columns: ["from_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fx_rates_to_currency_fkey"
            columns: ["to_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      ir_ticket_edits: {
        Row: {
          actor: string | null
          at: string
          column_name: string
          entity_code: string | null
          id: number
          item_code: string | null
          new_value: Json | null
          old_value: Json | null
          row_id: string | null
          ticket_id: string
        }
        Insert: {
          actor?: string | null
          at?: string
          column_name: string
          entity_code?: string | null
          id?: number
          item_code?: string | null
          new_value?: Json | null
          old_value?: Json | null
          row_id?: string | null
          ticket_id: string
        }
        Update: {
          actor?: string | null
          at?: string
          column_name?: string
          entity_code?: string | null
          id?: number
          item_code?: string | null
          new_value?: Json | null
          old_value?: Json | null
          row_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_ticket_edits_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ir_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_ticket_events: {
        Row: {
          action: string
          actor: string | null
          at: string
          comment: string | null
          from_status: string | null
          id: number
          internal: boolean
          ticket_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          at?: string
          comment?: string | null
          from_status?: string | null
          id?: number
          internal?: boolean
          ticket_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          at?: string
          comment?: string | null
          from_status?: string | null
          id?: number
          internal?: boolean
          ticket_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ir_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ir_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_ticket_items: {
        Row: {
          alt_code: string
          alt_description: string
          cost: number | null
          description: string
          entity_costs: Json
          erp_description: string | null
          id: string
          include: boolean
          is_new: boolean
          item_code: string
          line_no: number
          new_item: Json | null
          price_on_request: boolean
          source: Json | null
          ticket_id: string
          use_vendor_description: boolean
        }
        Insert: {
          alt_code?: string
          alt_description?: string
          cost?: number | null
          description?: string
          entity_costs?: Json
          erp_description?: string | null
          id?: string
          include?: boolean
          is_new?: boolean
          item_code: string
          line_no: number
          new_item?: Json | null
          price_on_request?: boolean
          source?: Json | null
          ticket_id: string
          use_vendor_description?: boolean
        }
        Update: {
          alt_code?: string
          alt_description?: string
          cost?: number | null
          description?: string
          entity_costs?: Json
          erp_description?: string | null
          id?: string
          include?: boolean
          is_new?: boolean
          item_code?: string
          line_no?: number
          new_item?: Json | null
          price_on_request?: boolean
          source?: Json | null
          ticket_id?: string
          use_vendor_description?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ir_ticket_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ir_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_ticket_rows: {
        Row: {
          calc: Json | null
          current_retail: number | null
          entity_code: string
          erp: Json
          flags: string[]
          id: string
          is_new: boolean
          item_code: string
          line_no: number
          names: Json | null
          retail_change_pct: number | null
          ticket_id: string
          updated_at: string
        }
        Insert: {
          calc?: Json | null
          current_retail?: number | null
          entity_code: string
          erp: Json
          flags?: string[]
          id?: string
          is_new?: boolean
          item_code: string
          line_no: number
          names?: Json | null
          retail_change_pct?: number | null
          ticket_id: string
          updated_at?: string
        }
        Update: {
          calc?: Json | null
          current_retail?: number | null
          entity_code?: string
          erp?: Json
          flags?: string[]
          id?: string
          is_new?: boolean
          item_code?: string
          line_no?: number
          names?: Json | null
          retail_change_pct?: number | null
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_ticket_rows_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ir_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_tickets: {
        Row: {
          approver_id: string | null
          brand_activity: string
          counts: Json | null
          created_at: string
          cross_check: Json | null
          decided_at: string | null
          draft: Json | null
          effective_from: string | null
          entities: Json
          id: string
          incomplete: Json
          kind: string
          missing_setup: Json
          needed_by: string | null
          price_summary: Json | null
          proceeded_at: string | null
          region: string
          reject_reason: string | null
          resubmit_of: string | null
          review_started_at: string | null
          reviewer_id: string | null
          revision: number
          source: string
          special_instructions: string
          status: string
          std_currency: string
          step: number
          submitted_at: string | null
          suppliers: Json
          ticket_no: string | null
          updated_at: string
          uploaded_at: string | null
          uploads: Json
          user_id: string
          verified_at: string | null
        }
        Insert: {
          approver_id?: string | null
          brand_activity: string
          counts?: Json | null
          created_at?: string
          cross_check?: Json | null
          decided_at?: string | null
          draft?: Json | null
          effective_from?: string | null
          entities?: Json
          id?: string
          incomplete?: Json
          kind?: string
          missing_setup?: Json
          needed_by?: string | null
          price_summary?: Json | null
          proceeded_at?: string | null
          region?: string
          reject_reason?: string | null
          resubmit_of?: string | null
          review_started_at?: string | null
          reviewer_id?: string | null
          revision?: number
          source?: string
          special_instructions?: string
          status?: string
          std_currency?: string
          step?: number
          submitted_at?: string | null
          suppliers?: Json
          ticket_no?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploads?: Json
          user_id?: string
          verified_at?: string | null
        }
        Update: {
          approver_id?: string | null
          brand_activity?: string
          counts?: Json | null
          created_at?: string
          cross_check?: Json | null
          decided_at?: string | null
          draft?: Json | null
          effective_from?: string | null
          entities?: Json
          id?: string
          incomplete?: Json
          kind?: string
          missing_setup?: Json
          needed_by?: string | null
          price_summary?: Json | null
          proceeded_at?: string | null
          region?: string
          reject_reason?: string | null
          resubmit_of?: string | null
          review_started_at?: string | null
          reviewer_id?: string | null
          revision?: number
          source?: string
          special_instructions?: string
          status?: string
          std_currency?: string
          step?: number
          submitted_at?: string | null
          suppliers?: Json
          ticket_no?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploads?: Json
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ir_tickets_resubmit_of_fkey"
            columns: ["resubmit_of"]
            isOneToOne: false
            referencedRelation: "ir_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      item_status_changes: {
        Row: {
          brand_activity: string
          created_at: string
          decided_at: string | null
          entity_code: string
          id: string
          inactive_from: number | null
          inactive_to: number
          item_code: string
          state: string
          ticket_id: string
        }
        Insert: {
          brand_activity: string
          created_at?: string
          decided_at?: string | null
          entity_code: string
          id?: string
          inactive_from?: number | null
          inactive_to: number
          item_code: string
          state?: string
          ticket_id: string
        }
        Update: {
          brand_activity?: string
          created_at?: string
          decided_at?: string | null
          entity_code?: string
          id?: string
          inactive_from?: number | null
          inactive_to?: number
          item_code?: string
          state?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_status_changes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ir_tickets"
            referencedColumns: ["id"]
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
      midwich_families: {
        Row: {
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
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
      pdf_history: {
        Row: {
          brand_activity: string
          created_at: string
          created_by: string
          entity_code: string
          id: string
          item_count: number
          title: string
        }
        Insert: {
          brand_activity: string
          created_at?: string
          created_by?: string
          entity_code: string
          id?: string
          item_count: number
          title: string
        }
        Update: {
          brand_activity?: string
          created_at?: string
          created_by?: string
          entity_code?: string
          id?: string
          item_count?: number
          title?: string
        }
        Relationships: []
      }
      pdf_orders: {
        Row: {
          brand_activity: string
          item_codes: string[]
          source_file: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand_activity: string
          item_codes?: string[]
          source_file?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand_activity?: string
          item_codes?: string[]
          source_file?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdf_orders_brand_activity_fkey"
            columns: ["brand_activity"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["brand_activity"]
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
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
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
      units: {
        Row: {
          active: boolean
          code: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          name: string
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
      user_brand_access: {
        Row: {
          brand_activity: string
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          brand_activity: string
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          brand_activity?: string
          created_at?: string
          created_by?: string | null
          user_id?: string
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
          cost_currency: string | null
          cost_price: number | null
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
          cost_currency: string | null
          cost_price: number | null
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
          active: boolean
          created_at: string
          email: string
          full_name: string
          roles: string[]
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
      admin_set_roles: {
        Args: { _roles: string[]; _user_id: string }
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
      has_any_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ir_approve: {
        Args: { _actor: string; _ticket: string }
        Returns: {
          approver_id: string | null
          brand_activity: string
          counts: Json | null
          created_at: string
          cross_check: Json | null
          decided_at: string | null
          draft: Json | null
          effective_from: string | null
          entities: Json
          id: string
          incomplete: Json
          kind: string
          missing_setup: Json
          needed_by: string | null
          price_summary: Json | null
          proceeded_at: string | null
          region: string
          reject_reason: string | null
          resubmit_of: string | null
          review_started_at: string | null
          reviewer_id: string | null
          revision: number
          source: string
          special_instructions: string
          status: string
          std_currency: string
          step: number
          submitted_at: string | null
          suppliers: Json
          ticket_no: string | null
          updated_at: string
          uploaded_at: string | null
          uploads: Json
          user_id: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ir_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ir_transition: {
        Args: {
          _action: string
          _actor: string
          _comment?: string
          _from: string[]
          _internal?: boolean
          _patch?: Json
          _ticket: string
          _to: string
        }
        Returns: {
          approver_id: string | null
          brand_activity: string
          counts: Json | null
          created_at: string
          cross_check: Json | null
          decided_at: string | null
          draft: Json | null
          effective_from: string | null
          entities: Json
          id: string
          incomplete: Json
          kind: string
          missing_setup: Json
          needed_by: string | null
          price_summary: Json | null
          proceeded_at: string | null
          region: string
          reject_reason: string | null
          resubmit_of: string | null
          review_started_at: string | null
          reviewer_id: string | null
          revision: number
          source: string
          special_instructions: string
          status: string
          std_currency: string
          step: number
          submitted_at: string | null
          suppliers: Json
          ticket_no: string | null
          updated_at: string
          uploaded_at: string | null
          uploads: Json
          user_id: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ir_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      list_brands: {
        Args: never
        Returns: {
          brand_activity: string
          default_unit: string
          sub_activities: string[]
        }[]
      }
      list_brands_v3: {
        Args: never
        Returns: {
          brand_activity: string
          default_unit: string
          entity_codes: string[]
          has_logo: boolean
          last_currency: string
          sub_activities: string[]
        }[]
      }
      merge_erp_import: { Args: { _import_id: string }; Returns: number }
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
      app_role: "admin" | "user" | "reviewer" | "approver"
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
      app_role: ["admin", "user", "reviewer", "approver"],
    },
  },
} as const
