import { afterEach, describe, expect, it } from "vitest";

import { getApiUrl } from "./apiUrl";

afterEach(() => {
  delete window.__API_URL__;
});

describe("getApiUrl", () => {
  it("prioriza window.__API_URL__ injetado em runtime", () => {
    window.__API_URL__ = "https://api.exemplo.com/";
    expect(getApiUrl()).toBe("https://api.exemplo.com");
  });

  it("cai no default local quando nada foi injetado", () => {
    expect(getApiUrl()).toBe("http://localhost:8000");
  });

  it("ignora string vazia no window e usa o default", () => {
    window.__API_URL__ = "   ";
    expect(getApiUrl()).toBe("http://localhost:8000");
  });
});
