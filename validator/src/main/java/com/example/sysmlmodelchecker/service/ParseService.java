package com.example.sysmlmodelchecker.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * 解析转发服务：把用户上传的 XML 转发给解析模块（Node 服务），
 * 取回 ParsedModel JSON（与 schema/parsed-model.schema.json 契约一致）。
 * 解析服务地址可用 parser.base-url 配置（默认 http://localhost:3000）。
 */
@Service
public class ParseService {

    private final String parserBaseUrl;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public ParseService(@Value("${parser.base-url:http://localhost:3000}") String parserBaseUrl,
                        ObjectMapper objectMapper) {
        this.parserBaseUrl = parserBaseUrl.endsWith("/")
                ? parserBaseUrl.substring(0, parserBaseUrl.length() - 1)
                : parserBaseUrl;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    /** 上传并解析：返回解析模块输出的 ParsedModel（JsonNode，原样透传）。 */
    public JsonNode parseXml(MultipartFile file) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(parserBaseUrl + "/api/models/import"))
                    .timeout(Duration.ofMinutes(5))
                    .header("Content-Type", "application/xml")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(file.getBytes()));
            String fileName = file.getOriginalFilename();
            if (fileName != null && isAsciiPrintable(fileName)) {
                builder.header("X-File-Name", fileName);
            }
            HttpResponse<String> response = httpClient.send(
                    builder.build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            String body = response.body() == null ? "" : response.body();
            if (response.statusCode() >= 400) {
                throw new IllegalArgumentException("解析模块返回 " + response.statusCode()
                        + "：" + extractMessage(body));
            }
            return objectMapper.readTree(body);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (IOException e) {
            throw new IllegalArgumentException("无法连接解析服务（" + parserBaseUrl
                    + "），请先双击 start-parser.cmd 启动解析端");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalArgumentException("解析请求被中断：" + e.getMessage());
        }
    }

    private static boolean isAsciiPrintable(String value) {
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c < 0x20 || c > 0x7e) {
                return false;
            }
        }
        return true;
    }

    private String extractMessage(String body) {
        try {
            JsonNode node = objectMapper.readTree(body);
            String message = node.path("message").asText(null);
            return message != null ? message : body;
        } catch (Exception e) {
            return body;
        }
    }
}