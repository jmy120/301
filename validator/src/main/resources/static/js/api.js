/* =========================================================
   API 封装：统一处理 Result{success,message,data} 包装
   ========================================================= */
const Api = (() => {

    async function request(url, options) {
        let res;
        try {
            res = await fetch(url, options);
        } catch (e) {
            throw new Error("网络请求失败，请确认后端已启动（http://localhost:8080）");
        }
        let body = null;
        const text = await res.text();
        if (text) {
            try { body = JSON.parse(text); } catch (e) { body = { success: false, message: text }; }
        }
        if (!res.ok) {
            throw new Error((body && body.message) || "HTTP " + res.status);
        }
        return body;
    }

    return {
        /** GET */
        get(url) {
            return request(url);
        },
        /** POST JSON */
        postJson(url, data) {
            return request(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
        },
        /** PUT JSON */
        putJson(url, data) {
            return request(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
        },
        /** DELETE */
        del(url) {
            return request(url, { method: "DELETE" });
        },
        /** multipart 文件上传 */
        upload(url, file) {
            const fd = new FormData();
            fd.append("file", file);
            return request(url, { method: "POST", body: fd });
        }
    };
})();