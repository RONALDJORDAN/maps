// Escola municipal — Pão de Açúcar/AL
// Pasta: escolas/paodeacucar/ | Rede + escola + endereço + localização

export const REDE_ENSINO = {
  nome: 'Rede Municipal de Ensino de Pão de Açúcar',
  municipio: 'Pão de Açúcar',
  uf: 'AL',
  ibge: '2706406'
}

export const ESCOLA_MUNICIPAL = {
  nome: 'EM Pão de Açúcar Centro',
  inep: '27064061',
  rede: REDE_ENSINO.nome,
  turno: 'manhã',
  alunos: 85,
  endereco: {
    logradouro: 'Praça da Matriz',
    numero: 'S/N',
    bairro: 'Centro',
    cep: '57580-000',
    cidade: 'Pão de Açúcar',
    uf: 'AL'
  },
  localizacao: {
    lat: -9.7467,
    lng: -37.431,
    ibge: '2706406'
  }
}

export default ESCOLA_MUNICIPAL
