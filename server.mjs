// Ponto de entrada NA RAIZ, para hospedagens gerenciadas (Hostinger e similares).
// O servidor inteiro — site estático + API/backend — vive em public/serve.mjs.
// Ele lê PORT do ambiente e escuta em todas as interfaces; o proxy da hospedagem
// encaminha o domínio para essa porta. Nada de build é necessário.
import './public/serve.mjs';
