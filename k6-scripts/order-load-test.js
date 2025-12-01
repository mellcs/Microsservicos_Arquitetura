import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 },   // aquecimento
    { duration: "1m", target: 100 },  // carga
    { duration: "1m", target: 300 },  // pico
    { duration: "1m", target: 500 },  // pico máximo
    { duration: "30s", target: 0 },    // resfriamento
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],     // menos de 1% de falhas
    http_req_duration: ["p(95)<500"],  // 95% das requisições < 500ms
  },
};

// ===============================
// Função de teste (VU)
// ===============================
export default function () {
  // 1. URL correta
  // service name: 'orders' (do docker-compose.yml)
  // internal port: 3000 (do environment do orders)
  // endpoint: /orders (para listar)
  const url = "http://orders:3000/orders";

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  // 2. Requisição GET
  const res = http.get(url, params);

  // 3. Checks (Verificações)
  // Verificando o status 200 (OK) e se a resposta é um array (lista)
  check(res, {
    "resposta OK (200)": (r) => r.status === 200,
    "resposta é um array": (r) => {
      try {
        // Tenta converter o corpo para JSON e verifica se é um array
        return Array.isArray(r.json());
      } catch (e) {
        return false; // Falha se o corpo não for JSON
      }
    },
  });

  sleep(1);
}