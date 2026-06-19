export interface Tenant {
  tenant_id: string;
  domain: string;
  plan: 'free' | 'pro' | string;
  created_at: string;
}

export type SourceType = 'website' | 'pdf' | 'faq' | 'text';

export interface Source {
  source_id: string;
  name: string;
  source_type: SourceType;
  status: 'ready' | 'indexing' | 'failed' | string;
  chunk_count?: number;
  last_indexed_at?: string;
  config?: Record<string, any>;
}

export interface CrawlJob {
  job_id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  pages_crawled: number;
  error_message?: string;
  created_at: string;
}

export interface FAQ {
  faq_id: string;
  question: string;
  answer: string;
  created_at: string;
}

export interface TextDoc {
  doc_id: string;
  title: string;
  body: string;
  created_at: string;
}

export interface Lead {
  lead_id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  created_at: string;
}

export interface KnowledgeGap {
  gap_id: string;
  query: string;
  gap_type?: 'no_context' | 'out_of_scope';
  count: number;
  status: 'open' | 'resolved' | 'dismissed';
  last_seen: string;
  url?: string;
  similar_faqs?: {
    faq_id: string;
    question: string;
    similarity: number;
  }[];
}

export interface Stats {
  open: number;
  resolved: number;
  total: number;
  no_context: number;
  out_of_scope: number;
  top_gaps: {
    gap_id: string;
    query: string;
    count: number;
  }[];
}
