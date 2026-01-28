import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/cn';

describe('cn (className utility)', () => {
  it('단일 클래스를 반환해야 한다', () => {
    expect(cn('btn')).toBe('btn');
  });

  it('여러 클래스를 병합해야 한다', () => {
    expect(cn('btn', 'btn-primary')).toBe('btn btn-primary');
  });

  it('조건부 클래스를 처리해야 한다', () => {
    expect(cn('btn', true && 'btn-active', false && 'btn-disabled')).toBe(
      'btn btn-active'
    );
  });

  it('Tailwind 충돌을 해결해야 한다', () => {
    // tailwind-merge가 충돌하는 클래스를 처리
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('undefined와 null을 무시해야 한다', () => {
    expect(cn('btn', undefined, null, 'btn-primary')).toBe('btn btn-primary');
  });

  it('빈 문자열을 무시해야 한다', () => {
    expect(cn('btn', '', 'btn-primary')).toBe('btn btn-primary');
  });

  it('객체 형태의 조건부 클래스를 처리해야 한다', () => {
    expect(
      cn({
        btn: true,
        'btn-active': true,
        'btn-disabled': false,
      })
    ).toBe('btn btn-active');
  });

  it('배열 형태의 클래스를 처리해야 한다', () => {
    expect(cn(['btn', 'btn-primary'])).toBe('btn btn-primary');
  });
});
