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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          object_id: string | null
          object_type: string | null
          previous_value: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          object_id?: string | null
          object_type?: string | null
          previous_value?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          object_id?: string | null
          object_type?: string | null
          previous_value?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      cashier_shifts: {
        Row: {
          cash_sales: number | null
          cashier_id: string
          closed_at: string | null
          declared_cash: number | null
          difference: number | null
          discrepancy_reason: string | null
          expected_cash: number | null
          id: string
          opened_at: string
          opening_cash: number
          status: string
        }
        Insert: {
          cash_sales?: number | null
          cashier_id: string
          closed_at?: string | null
          declared_cash?: number | null
          difference?: number | null
          discrepancy_reason?: string | null
          expected_cash?: number | null
          id?: string
          opened_at?: string
          opening_cash: number
          status?: string
        }
        Update: {
          cash_sales?: number | null
          cashier_id?: string
          closed_at?: string | null
          declared_cash?: number | null
          difference?: number | null
          discrepancy_reason?: string | null
          expected_cash?: number | null
          id?: string
          opened_at?: string
          opening_cash?: number
          status?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          created_by: string
          description: string
          expense_date: string
          id: string
          payment_method: string
          reference: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          created_by?: string
          description?: string
          expense_date?: string
          id?: string
          payment_method?: string
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          created_by?: string
          description?: string
          expense_date?: string
          id?: string
          payment_method?: string
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: string
          note: string | null
          product_id: string
          quantity: number
          reference: string | null
          unit_cost: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type: string
          note?: string | null
          product_id: string
          quantity: number
          reference?: string | null
          unit_cost?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: string
          note?: string | null
          product_id?: string
          quantity?: number
          reference?: string | null
          unit_cost?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          avg_cost: number
          last_cost: number
          product_id: string
          updated_at: string
        }
        Insert: {
          avg_cost?: number
          last_cost?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          avg_cost?: number
          last_cost?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          barcode: string | null
          brand: string | null
          category_id: string | null
          created_at: string
          id: string
          image_url: string | null
          is_demo: boolean
          low_stock_threshold: number
          name: string
          selling_price: number
          sku: string
          stock_qty: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_demo?: boolean
          low_stock_threshold?: number
          name: string
          selling_price: number
          sku: string
          stock_qty?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_demo?: boolean
          low_stock_threshold?: number
          name?: string
          selling_price?: number
          sku?: string
          stock_qty?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
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
      purchase_items: {
        Row: {
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          subtotal: number
          unit_cost: number
        }
        Insert: {
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          subtotal: number
          unit_cost: number
        }
        Update: {
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          subtotal?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invoice_no: string | null
          paid: boolean
          purchase_date: string
          supplier_id: string
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          invoice_no?: string | null
          paid?: boolean
          purchase_date?: string
          supplier_id: string
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invoice_no?: string | null
          paid?: boolean
          purchase_date?: string
          supplier_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_item_costs: {
        Row: {
          sale_item_id: string
          total_cost: number
          unit_cost: number
        }
        Insert: {
          sale_item_id: string
          total_cost: number
          unit_cost: number
        }
        Update: {
          sale_item_id?: string
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_item_costs_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: true
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          id?: string
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cash_received: number | null
          cashier_id: string
          client_ref: string
          created_at: string
          discount: number
          id: string
          payment_method: string
          receipt_no: string
          shift_id: string | null
          status: string
          subtotal: number
          total: number
        }
        Insert: {
          cash_received?: number | null
          cashier_id: string
          client_ref: string
          created_at?: string
          discount?: number
          id?: string
          payment_method: string
          receipt_no: string
          shift_id?: string | null
          status?: string
          subtotal: number
          total: number
        }
        Update: {
          cash_received?: number | null
          cashier_id?: string
          client_ref?: string
          created_at?: string
          discount?: number
          id?: string
          payment_method?: string
          receipt_no?: string
          shift_id?: string | null
          status?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "cashier_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          contact: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          _note: string
          _product: string
          _qty_change: number
          _type: string
        }
        Returns: undefined
      }
      can_see_costs: { Args: { _user_id: string }; Returns: boolean }
      close_shift: {
        Args: { _declared: number; _reason: string }
        Returns: Json
      }
      club_has_owner: { Args: never; Returns: boolean }
      complete_sale: {
        Args: {
          _cash_received?: number
          _client_ref: string
          _discount: number
          _items: Json
          _payment: string
        }
        Returns: Json
      }
      delete_product: { Args: { _product: string }; Returns: undefined }
      expense_breakdown: {
        Args: { _end: string; _start: string }
        Returns: {
          category: string
          total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff_admin: { Args: { _user_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          _action: string
          _id: string
          _new: Json
          _prev: Json
          _type: string
        }
        Returns: undefined
      }
      open_shift: { Args: { _opening_cash: number }; Returns: string }
      pnl_daily: {
        Args: { _end: string; _start: string }
        Returns: {
          cogs: number
          day: string
          expenses: number
          revenue: number
          transactions: number
        }[]
      }
      receive_stock: {
        Args: {
          _product: string
          _qty: number
          _reference: string
          _unit_cost: number
        }
        Returns: undefined
      }
      record_purchase: {
        Args: {
          _date: string
          _invoice: string
          _items: Json
          _paid: boolean
          _supplier: string
        }
        Returns: string
      }
      set_purchase_paid: {
        Args: { _id: string; _paid: boolean }
        Returns: undefined
      }
      void_expense: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "cashier" | "stock_manager"
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
      app_role: ["owner", "manager", "cashier", "stock_manager"],
    },
  },
} as const
