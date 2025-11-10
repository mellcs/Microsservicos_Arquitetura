import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 100 },
    { duration: "1m", target: 300 },
    { duration: "1m", target: 500 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const url = "http://payments:3000/payments";

  // 1. O Payload (Corpo) CORRIGIDO
  // -----------------------------------------------------------------
  // !!! ATENÇÃO !!!
  // Você DEVE substituir o valor "id-real..." por um ID
  // que exista no seu banco 'mongo_orders' e tenha status 'PENDING'.
  // Se não fizer isso, o teste falhará com HTTP 404.
  // -----------------------------------------------------------------
  const payload = JSON.stringify({
    orderId: "69094642ebe9ff48dece5f46", // <--- COLOQUE SEU ID REAL AQUI
    method: "credit_card",
  });

  // 2. Os Headers (Parâmetros)
  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  // 3. A Requisição (Enviando payload e params)
  const res = http.post(url, payload, params);

  // 4. Os Checks (Verificações) CORRIGIDOS
  // O status de sucesso para criar algo (POST) é 201
  check(res, {
    "resposta de criação OK (201)": (r) => r.status === 201,
    "resposta contém um ID de pagamento": (r) => r.json("id") !== undefined,
  });

  sleep(1);
}