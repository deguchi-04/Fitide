export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <article>
        <p className="eyebrow">FITIDE · PRIVACIDADE</p>
        <h1>Dados de saúde sob o teu controlo</h1>
        <p>
          A Fitide é uma aplicação de uso pessoal. Quando autorizas o Health
          Connect, a aplicação lê apenas os dados escolhidos por ti — passos,
          calorias ativas, frequência cardíaca, sono e percentagem de gordura —
          para os apresentar no teu painel.
        </p>
        <h2>Como os dados são usados</h2>
        <p>
          Os dados importados servem exclusivamente para acompanhar a tua
          rotina. Não são vendidos, usados para publicidade nem partilhados
          com terceiros. A cópia sincronizada fica na base privada da tua
          aplicação.
        </p>
        <h2>Fotografias e produtos</h2>
        <p>Ao pedir o reconhecimento de uma fotografia, a imagem é enviada à API Gemini da Google. Não enviamos os dados do Health Connect nessa análise. A Fitide não guarda a fotografia no servidor. As condições da Google aplicam-se ao processamento. Para códigos de barras, enviamos apenas o código ao Open Food Facts. Os resultados devem ser confirmados antes de guardar.</p>
        <h2>Escolha e eliminação</h2>
        <p>
          Podes negar ou revogar permissões no Health Connect a qualquer
          momento. Em Definições também podes apagar o perfil e todos os dados
          guardados na Fitide.
        </p>
        <p>
          A Fitide fornece estimativas de bem-estar e não substitui orientação
          médica ou nutricional profissional.
        </p>
      </article>
    </main>
  );
}
