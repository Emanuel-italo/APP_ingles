// Original course content. Each lesson is a short "speak it out loud" drill:
// the learner hears a phrase, repeats it, and gets a pronunciation score.

export const lessons = [
  {
    id: 'intro-1',
    unit: 'Primeiros passos',
    title: 'Se apresentando',
    icon: 'hand-left-outline',
    level: 'beginner',
    phrases: [
      { en: 'Hi, my name is Ana.', pt: 'Oi, meu nome é Ana.' },
      { en: "I'm from Brazil.", pt: 'Eu sou do Brasil.' },
      { en: 'Nice to meet you.', pt: 'Prazer em te conhecer.' },
      { en: 'I work as a designer.', pt: 'Eu trabalho como designer.' },
      { en: "I'm learning English.", pt: 'Estou aprendendo inglês.' },
    ],
  },
  {
    id: 'intro-2',
    unit: 'Primeiros passos',
    title: 'Fazendo perguntas',
    icon: 'help-circle-outline',
    level: 'beginner',
    phrases: [
      { en: "What's your name?", pt: 'Qual é o seu nome?' },
      { en: 'Where are you from?', pt: 'De onde você é?' },
      { en: 'What do you do?', pt: 'O que você faz (profissão)?' },
      { en: 'How long have you lived here?', pt: 'Há quanto tempo você mora aqui?' },
      { en: 'Do you have any hobbies?', pt: 'Você tem algum hobby?' },
    ],
  },
  {
    id: 'food-1',
    unit: 'Dia a dia',
    title: 'No restaurante',
    icon: 'restaurant-outline',
    level: 'beginner',
    phrases: [
      { en: 'A table for two, please.', pt: 'Uma mesa para dois, por favor.' },
      { en: 'Could I see the menu?', pt: 'Posso ver o cardápio?' },
      { en: "I'd like the chicken salad.", pt: 'Eu gostaria da salada de frango.' },
      { en: 'Can we get the check, please?', pt: 'Pode trazer a conta, por favor?' },
      { en: 'Is service included?', pt: 'O serviço está incluído?' },
    ],
  },
  {
    id: 'travel-1',
    unit: 'Viagem',
    title: 'No aeroporto',
    icon: 'airplane-outline',
    level: 'intermediate',
    phrases: [
      { en: "I'd like to check in for my flight.", pt: 'Gostaria de fazer o check-in do meu voo.' },
      { en: 'Can I have a window seat?', pt: 'Posso ficar na janela?' },
      { en: 'Is this bag too heavy?', pt: 'Essa mala está pesada demais?' },
      { en: 'Where is gate twelve?', pt: 'Onde fica o portão doze?' },
      { en: 'My flight has been delayed.', pt: 'Meu voo atrasou.' },
    ],
  },
  {
    id: 'travel-2',
    unit: 'Viagem',
    title: 'Pedindo direções',
    icon: 'navigate-outline',
    level: 'intermediate',
    phrases: [
      { en: 'Excuse me, how do I get to the station?', pt: 'Com licença, como chego à estação?' },
      { en: 'Is it within walking distance?', pt: 'Dá para ir a pé?' },
      { en: 'Turn left at the next corner.', pt: 'Vire à esquerda na próxima esquina.' },
      { en: "It's right across the street.", pt: 'Fica bem do outro lado da rua.' },
      { en: 'Could you show me on the map?', pt: 'Você poderia me mostrar no mapa?' },
    ],
  },
  {
    id: 'work-1',
    unit: 'Trabalho',
    title: 'Reuniões',
    icon: 'briefcase-outline',
    level: 'advanced',
    phrases: [
      { en: "Let's get started, shall we?", pt: 'Vamos começar?' },
      { en: 'Could you walk us through the numbers?', pt: 'Você poderia nos explicar os números?' },
      { en: 'I see your point, but I have a concern.', pt: 'Entendo seu ponto, mas tenho uma preocupação.' },
      { en: "Let's circle back to this next week.", pt: 'Vamos retomar isso na semana que vem.' },
      { en: "I'll follow up by email.", pt: 'Vou dar seguimento por e-mail.' },
    ],
  },
  {
    id: 'work-2',
    unit: 'Trabalho',
    title: 'Entrevista de emprego',
    icon: 'people-outline',
    level: 'advanced',
    phrases: [
      { en: 'Thank you for having me today.', pt: 'Obrigado por me receber hoje.' },
      { en: 'I have five years of experience in sales.', pt: 'Tenho cinco anos de experiência em vendas.' },
      { en: 'My greatest strength is problem solving.', pt: 'Meu maior ponto forte é resolver problemas.' },
      { en: "I'm looking for new challenges.", pt: 'Estou procurando novos desafios.' },
      { en: 'What does a typical day look like here?', pt: 'Como é um dia típico aqui?' },
    ],
  },
];

// Role-play scenarios for the AI tutor conversation.

export { scenarios } from './scenarios.js';
