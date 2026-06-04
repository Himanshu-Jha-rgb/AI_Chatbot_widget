const DEFAULT_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export const chat = async (query, current_url, current_page_title, apiKey, apiBaseUrl = DEFAULT_API_BASE_URL) => {
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

export const submitEnquiry = async (data, apiKey, apiBaseUrl = DEFAULT_API_BASE_URL) => {
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
