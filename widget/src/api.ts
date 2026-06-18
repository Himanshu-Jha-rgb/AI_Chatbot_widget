const DEFAULT_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export interface ChatResponse {
    message_id: string;
    answer: string;
    sources: any[];
    show_enquiry_form?: boolean;
}

export interface WidgetConfig {
    theme?: string;
    suggested_questions?: string[];
}

export interface EnquiryData {
    name: string;
    email: string;
    phone?: string;
    message: string;
    session_id: string;
}

export const chat = async (
    query: string,
    current_url: string,
    current_page_title: string,
    apiKey: string,
    apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<ChatResponse> => {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        credentials: "include",
        body: JSON.stringify({
            query,
            current_url,
            current_page_title
        })
    });

    if (!response.ok) {
        throw new Error("Chat request failed");
    }

    return response.json();
};

export const getWidgetConfig = async (
    apiKey: string,
    apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<WidgetConfig> => {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/widget/config`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        throw new Error("Failed to fetch widget config");
    }

    return response.json();
};

export const submitEnquiry = async (
    data: EnquiryData,
    apiKey: string,
    apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<any> => {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/leads`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        throw new Error("Enquiry submission failed");
    }

    return response.json();
};

export const submitFeedback = async (
    messageId: string,
    sessionId: string,
    rating: 'like' | 'dislike',
    apiKey: string,
    apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<any> => {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/feedback`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            message_id: messageId,
            session_id: sessionId,
            rating
        })
    });

    if (!response.ok) {
        throw new Error("Feedback submission failed");
    }

    return response.json();
};
