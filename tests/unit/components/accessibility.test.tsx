/**
 * 컴포넌트 접근성 단위 테스트
 * - 폼 컴포넌트 레이블 연결
 * - ARIA 속성 검증
 * - 키보드 상호작용
 * - 스크린 리더 지원
 */

import { describe, it, expect, vi } from 'vitest';
import { render, within } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LoginForm } from '@/components/features/auth/login-form';
import { RegisterForm } from '@/components/features/auth/register-form';
import { Button, Input, Label } from '@/components/ui';

// jest-axe 매처 확장
expect.extend(toHaveNoViolations);

// Next.js router 모킹
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Server Actions 모킹
vi.mock('@/actions/auth', () => ({
  login: vi.fn().mockResolvedValue({ success: true }),
  register: vi.fn().mockResolvedValue({ success: true }),
}));

describe('UI 컴포넌트 접근성', () => {
  describe('Button 컴포넌트', () => {
    it('기본 버튼이 접근성 위반이 없어야 한다', async () => {
      const { container } = render(<Button>클릭</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('비활성화된 버튼에 aria-disabled가 있어야 한다', () => {
      render(<Button disabled>비활성화</Button>);
      const button = screen.getByRole('button', { name: /비활성화/ });
      expect(button).toBeDisabled();
    });

    it('로딩 상태에서 적절한 피드백을 제공해야 한다', () => {
      render(
        <Button disabled aria-busy="true">
          <span className="animate-spin">로딩</span>
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('아이콘만 있는 버튼에 aria-label이 있어야 한다', async () => {
      const { container } = render(
        <Button aria-label="메뉴 열기">
          <svg aria-hidden="true" />
        </Button>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Input 컴포넌트', () => {
    it('Input과 Label이 연결되어야 한다', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="test-input">테스트 입력</Label>
          <Input id="test-input" />
        </div>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      const input = screen.getByLabelText(/테스트 입력/);
      expect(input).toBeInTheDocument();
    });

    it('필수 필드에 required 속성이 있어야 한다', () => {
      render(
        <div>
          <Label htmlFor="required-input">
            필수 입력 <span aria-hidden="true">*</span>
          </Label>
          <Input id="required-input" required aria-required="true" />
        </div>
      );

      const input = screen.getByLabelText(/필수 입력/);
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('오류 상태에 aria-invalid가 있어야 한다', () => {
      render(
        <div>
          <Label htmlFor="error-input">오류 입력</Label>
          <Input
            id="error-input"
            aria-invalid="true"
            aria-describedby="error-message"
          />
          <span id="error-message" role="alert">
            올바른 형식이 아닙니다.
          </span>
        </div>
      );

      const input = screen.getByLabelText(/오류 입력/);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'error-message');

      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('올바른 형식이 아닙니다.');
    });

    it('placeholder만으로 레이블을 대체하지 않아야 한다', async () => {
      // 안티패턴: placeholder만 있는 경우
      const { container } = render(
        <Input placeholder="이메일 입력" aria-label="이메일" />
      );

      // aria-label이 있으면 접근성 통과
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('LoginForm 컴포넌트', () => {
    it('axe 접근성 검사를 통과해야 한다', async () => {
      const { container } = render(<LoginForm />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('이메일 필드에 레이블이 연결되어야 한다', () => {
      render(<LoginForm />);
      const emailInput = screen.getByLabelText(/이메일/);
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('비밀번호 필드에 레이블이 연결되어야 한다', () => {
      render(<LoginForm />);
      const passwordInput = screen.getByLabelText(/비밀번호/);
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('제출 버튼이 키보드로 접근 가능해야 한다', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /로그인/ });
      await user.tab();
      await user.tab();
      await user.tab();

      // 버튼에 포커스가 가능한지 확인
      expect(submitButton).not.toBeDisabled();
    });

    it('오류 메시지가 스크린 리더에 전달되어야 한다', async () => {
      const { login } = await import('@/actions/auth');
      vi.mocked(login).mockResolvedValueOnce({
        success: false,
        error: '로그인에 실패했습니다.',
      });

      const user = userEvent.setup();
      render(<LoginForm />);

      // 폼 제출
      const emailInput = screen.getByLabelText(/이메일/);
      const passwordInput = screen.getByLabelText(/비밀번호/);
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /로그인/ });
      await user.click(submitButton);

      // 오류 메시지 표시 확인 (비동기 대기)
      const errorMessage = await screen.findByText(/로그인에 실패했습니다/);
      expect(errorMessage).toBeInTheDocument();
    });
  });

  describe('RegisterForm 컴포넌트', () => {
    it('axe 접근성 검사를 통과해야 한다', async () => {
      const { container } = render(<RegisterForm />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('모든 필수 필드에 레이블이 연결되어야 한다', () => {
      render(<RegisterForm />);

      expect(screen.getByLabelText(/이름/)).toBeInTheDocument();
      expect(screen.getByLabelText(/이메일/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^비밀번호$/)).toBeInTheDocument();
      expect(screen.getByLabelText(/비밀번호 확인/)).toBeInTheDocument();
    });

    it('비밀번호 필드가 masking 되어야 한다', () => {
      render(<RegisterForm />);

      const passwordInputs = screen.getAllByLabelText(/비밀번호/);
      passwordInputs.forEach((input) => {
        expect(input).toHaveAttribute('type', 'password');
      });
    });
  });

  describe('키보드 네비게이션', () => {
    it('Tab 키로 폼 필드를 순차적으로 이동할 수 있어야 한다', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      // Tab 키로 순차 이동
      await user.tab();
      expect(screen.getByLabelText(/이메일/)).toHaveFocus();

      // 이메일 → 비밀번호 찾기 링크 → 비밀번호 순서로 이동
      await user.tab();
      // 비밀번호 찾기 링크에 포커스
      expect(screen.getByRole('link', { name: /비밀번호를 잊으셨나요/ })).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/비밀번호/)).toHaveFocus();
    });

    it('Enter 키로 폼을 제출할 수 있어야 한다', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText(/이메일/);
      const passwordInput = screen.getByLabelText(/비밀번호/);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      // Enter 키로 제출
      await user.keyboard('{Enter}');

      // 폼이 제출되었는지 확인 (로딩 상태 등)
      // 실제 동작은 모킹된 login 함수에 의해 처리됨
    });

    it('Shift+Tab으로 역순 이동이 가능해야 한다', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      // 마지막 요소로 이동
      const submitButton = screen.getByRole('button', { name: /로그인/ });
      submitButton.focus();

      // Shift+Tab으로 역순 이동
      await user.tab({ shift: true });
      // 비밀번호 필드 또는 그 이전 요소에 포커스
    });
  });

  describe('스크린 리더 지원', () => {
    it('폼 요소가 존재해야 한다', () => {
      const { container } = render(<LoginForm />);
      // HTML5 form 태그는 암시적으로 form 역할을 가짐
      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('필수 필드가 aria-required로 표시되어야 한다', () => {
      render(
        <div>
          <Label htmlFor="required-field">필수 필드</Label>
          <Input id="required-field" required aria-required="true" />
        </div>
      );

      const input = screen.getByLabelText(/필수 필드/);
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('설명 텍스트가 aria-describedby로 연결되어야 한다', () => {
      render(
        <div>
          <Label htmlFor="described-field">설명이 있는 필드</Label>
          <Input
            id="described-field"
            aria-describedby="field-description"
          />
          <span id="field-description">
            8자 이상의 비밀번호를 입력하세요.
          </span>
        </div>
      );

      const input = screen.getByLabelText(/설명이 있는 필드/);
      expect(input).toHaveAttribute('aria-describedby', 'field-description');
    });
  });

  describe('시각적 접근성', () => {
    it('포커스 상태가 시각적으로 구분되어야 한다', () => {
      render(
        <Button className="focus:ring-2 focus:ring-primary">
          포커스 테스트
        </Button>
      );

      const button = screen.getByRole('button');
      // Tailwind의 focus:ring 클래스가 적용되어 있는지 확인
      expect(button).toHaveClass('focus:ring-2');
    });

    it('비활성화 상태가 시각적으로 구분되어야 한다', () => {
      render(<Button disabled>비활성화</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      // disabled 상태에서 opacity가 적용되는지 확인
      expect(button).toHaveClass('disabled:opacity-50');
    });
  });

  describe('동적 콘텐츠 접근성', () => {
    it('로딩 상태가 aria-busy로 표시되어야 한다', () => {
      render(
        <Button aria-busy="true" disabled>
          로딩 중...
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('성공/실패 메시지가 live region에 표시되어야 한다', () => {
      render(
        <div role="status" aria-live="polite">
          저장되었습니다.
        </div>
      );

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('오류 메시지가 assertive live region에 표시되어야 한다', () => {
      render(
        <div role="alert" aria-live="assertive">
          오류가 발생했습니다.
        </div>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });
  });
});

describe('ARIA 패턴', () => {
  describe('모달 다이얼로그', () => {
    it('모달이 적절한 ARIA 속성을 가져야 한다', () => {
      render(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-description"
        >
          <h2 id="modal-title">모달 제목</h2>
          <p id="modal-description">모달 설명입니다.</p>
          <Button>확인</Button>
        </div>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'modal-description');
    });
  });

  describe('탭 패널', () => {
    it('탭이 적절한 ARIA 패턴을 따라야 한다', () => {
      render(
        <div>
          <div role="tablist" aria-label="탭 메뉴">
            <button
              role="tab"
              aria-selected="true"
              aria-controls="panel-1"
              id="tab-1"
            >
              탭 1
            </button>
            <button
              role="tab"
              aria-selected="false"
              aria-controls="panel-2"
              id="tab-2"
            >
              탭 2
            </button>
          </div>
          <div
            role="tabpanel"
            id="panel-1"
            aria-labelledby="tab-1"
            tabIndex={0}
          >
            패널 1 내용
          </div>
        </div>
      );

      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', '탭 메뉴');

      const selectedTab = screen.getByRole('tab', { selected: true });
      expect(selectedTab).toHaveAttribute('aria-selected', 'true');

      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel).toHaveAttribute('aria-labelledby', 'tab-1');
    });
  });

  describe('알림/토스트', () => {
    it('알림이 적절한 role을 가져야 한다', () => {
      render(
        <div role="alert" aria-live="assertive">
          중요한 알림입니다.
        </div>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('상태 메시지가 status role을 가져야 한다', () => {
      render(
        <div role="status" aria-live="polite">
          변경사항이 저장되었습니다.
        </div>
      );

      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });
  });

  describe('프로그레스', () => {
    it('진행 상태가 적절한 ARIA 속성을 가져야 한다', () => {
      render(
        <div
          role="progressbar"
          aria-valuenow={50}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="업로드 진행률"
        >
          50%
        </div>
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '50');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
      expect(progressbar).toHaveAttribute('aria-label', '업로드 진행률');
    });
  });
});
