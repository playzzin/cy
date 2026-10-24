import { privateLiterals } from './editPrivacy';

test('VBA 문자열, 인라인 Rem, 이어지는 주석을 가리고 코드는 유지한다', () => {
  const literals=privateLiterals();
  const code='Attribute VB_Name = "SecretModule"\r\nRem private-one\r\nx = "private-value": Rem private-two _\r\nprivate-continuation\r\ny = "don\'t say ""Rem""" \' private-three\r\nz = "": Remember = 1';
  const masked=literals.mask(code,true);
  expect(masked).not.toMatch(/private|SecretModule/);
  expect(masked).toContain('Remember = 1');
  expect(literals.restore(masked)).toContain('"don\'t say ""Rem"""');
  expect(literals.restore(masked)).toContain('x = "private-value":');
});

test.each(['__LOCAL_LITERAL_0__','"prefix __LOCAL_LITERAL_0__"','"__LOCAL_LITERAL_0__ suffix"','"__LOCAL_LITERAL_999__"','"__local_literal_0__"','"__LOCAL_LITERAL_0__'])('손상된 참조 %s는 파일에 쓰지 않는다', code => {
  const literals=privateLiterals();literals.mask('"original"');
  expect(()=>literals.restore(code)).toThrow('참조가 바뀌었습니다');
});

test('토큰처럼 생긴 원문과 따옴표가 있는 수식은 한 번만 복원한다', () => {
  const literals=privateLiterals();
  const original='IF(\'Sheet One\'!A1="__LOCAL_LITERAL_1__","a""b","")';
  expect(literals.restore(literals.mask(original))).toBe(original);
});
