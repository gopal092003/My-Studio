export type AppRole = "admin" | "user";
export type ContentSection =
  | "art"
  | "craft"
  | "manga"
  | "stories"
  | "anime"
  | "poem"
  | "soundtrack";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          role: AppRole;
          is_restricted: boolean;
          restriction_reason: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          role?: AppRole;
          is_restricted?: boolean;
          restriction_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          role?: AppRole;
          is_restricted?: boolean;
          restriction_reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      content_items: {
        Row: {
          id: string;
          section_slug: ContentSection;
          title: string;
          summary: string | null;
          body: string | null;
          asset_url: string | null;
          is_published: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          section_slug: ContentSection;
          title: string;
          summary?: string | null;
          body?: string | null;
          asset_url?: string | null;
          is_published?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          section_slug?: ContentSection;
          title?: string;
          summary?: string | null;
          body?: string | null;
          asset_url?: string | null;
          is_published?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      artworks: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          medium: string | null;
          dimensions: string | null;
          tags: string[];
          image_path: string;
          is_visible: boolean;
          scheduled_publish_at: string | null;
          views_count: number;
          likes_count: number;
          comments_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          name_sort: string;
          search_document: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          medium?: string | null;
          dimensions?: string | null;
          tags?: string[];
          image_path: string;
          is_visible?: boolean;
          scheduled_publish_at?: string | null;
          views_count?: number;
          likes_count?: number;
          comments_count?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          medium?: string | null;
          dimensions?: string | null;
          tags?: string[];
          image_path?: string;
          is_visible?: boolean;
          scheduled_publish_at?: string | null;
          views_count?: number;
          likes_count?: number;
          comments_count?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      artwork_images: {
        Row: {
          id: string;
          artwork_id: string;
          image_path: string;
          alt_text: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          artwork_id: string;
          image_path: string;
          alt_text?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          artwork_id?: string;
          image_path?: string;
          alt_text?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      art_chat_messages: {
        Row: {
          id: string;
          user_id: string;
          author_name: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          author_name?: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          author_name?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      moderation_reports: {
        Row: {
          id: string;
          target_type: ModerationReportTarget;
          target_id: string;
          reporter_id: string;
          reason: string;
          status: ModerationReportStatus;
          handled_by: string | null;
          handled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_type: ModerationReportTarget;
          target_id: string;
          reporter_id: string;
          reason: string;
          status?: ModerationReportStatus;
          handled_by?: string | null;
          handled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          target_type?: ModerationReportTarget;
          target_id?: string;
          reporter_id?: string;
          reason?: string;
          status?: ModerationReportStatus;
          handled_by?: string | null;
          handled_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      artwork_likes: {
        Row: { artwork_id: string; user_id: string; created_at: string };
        Insert: { artwork_id: string; user_id: string; created_at?: string };
        Update: { artwork_id?: string; user_id?: string; created_at?: string };
        Relationships: [];
      };
      artwork_comments: {
        Row: {
          id: string;
          artwork_id: string;
          user_id: string;
          parent_comment_id: string | null;
          author_name: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          artwork_id: string;
          user_id: string;
          parent_comment_id?: string | null;
          author_name?: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          artwork_id?: string;
          user_id?: string;
          parent_comment_id?: string | null;
          author_name?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      artwork_views: {
        Row: { artwork_id: string; visitor_id: string; viewed_on: string; created_at: string };
        Insert: { artwork_id: string; visitor_id: string; viewed_on?: string; created_at?: string };
        Update: { artwork_id?: string; visitor_id?: string; viewed_on?: string; created_at?: string };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          kind: NotificationKind;
          message: string;
          artwork_id: string | null;
          comment_id: string | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          kind: NotificationKind;
          message: string;
          artwork_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          kind?: NotificationKind;
          message?: string;
          artwork_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_restricted_user: { Args: Record<PropertyKey, never>; Returns: boolean };
      record_artwork_view: {
        Args: { p_artwork_id: string; p_visitor_id: string };
        Returns: boolean;
      };
      admin_delete_artwork_comment: {
        Args: { p_comment_id: string };
        Returns: undefined;
      };
      admin_delete_art_chat_message: {
        Args: { p_message_id: string };
        Returns: undefined;
      };
      admin_replace_artwork_images: {
        Args: { p_artwork_id: string; p_image_paths: string[] };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: AppRole;
      content_section: ContentSection;
      notification_kind: NotificationKind;
      moderation_report_target: ModerationReportTarget;
      moderation_report_status: ModerationReportStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type NotificationKind =
  | "account_restricted"
  | "restriction_lifted"
  | "comment_removed"
  | "chat_message_removed"
  | "report_reviewed";

export type ModerationReportTarget = "artwork_comment" | "chat_message";
export type ModerationReportStatus = "open" | "reviewed" | "dismissed";
