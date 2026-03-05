/** Test helpers that don't leak into production. */
export function expectNoFinancialAdvice(text: string) {
  const bad = /(buy now|sell now|you should buy|you should sell|guaranteed profit|financial advice)/i;
  expect(text).not.toMatch(bad);
}

export function expectNoIdentityAttack(text: string) {
  // identity attacks are personal insults or protected attributes targeting
  const bad = /(you are (an )?(idiot|loser)|doxx|address|home address)/i;
  expect(text).not.toMatch(bad);
}
