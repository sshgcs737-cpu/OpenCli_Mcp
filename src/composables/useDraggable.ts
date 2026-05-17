import { ref, watch, onBeforeUnmount, type Ref } from 'vue';

export interface UseDraggableOptions {
  /** 初始位置偏移 */
  initialX?: number;
  initialY?: number;
  /** 是否限制在视口内 */
  constrainToViewport?: boolean;
}

/**
 * 使面板可通过拖拽 header 来移动位置。
 * @param containerRef  面板容器的 template ref
 * @param handleSelector  拖拽手柄的 CSS 选择器（在容器内查找）
 * @param options  可选参数
 */
export function useDraggable(
  containerRef: Ref<HTMLElement | null>,
  handleSelector: string,
  options: UseDraggableOptions = {}
) {
  const { initialX = 0, initialY = 0, constrainToViewport = true } = options;

  const offsetX = ref(initialX);
  const offsetY = ref(initialY);
  const isDragging = ref(false);

  let startMouseX = 0;
  let startMouseY = 0;
  let startOffsetX = 0;
  let startOffsetY = 0;

  const onMouseDown = (e: MouseEvent) => {
    // 忽略来自按钮、输入框、关闭按钮等交互元素的事件
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('.neo-infobox-close') ||
      target.closest('.history-close-btn')
    ) {
      return;
    }

    e.preventDefault();
    isDragging.value = true;
    startMouseX = e.clientX;
    startMouseY = e.clientY;
    startOffsetX = offsetX.value;
    startOffsetY = offsetY.value;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return;

    let newX = startOffsetX + (e.clientX - startMouseX);
    let newY = startOffsetY + (e.clientY - startMouseY);

    if (constrainToViewport && containerRef.value) {
      const rect = containerRef.value.getBoundingClientRect();
      const w = rect.width;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // 计算容器未偏移时的原始位置
      const origLeft = rect.left - offsetX.value;
      const origTop = rect.top - offsetY.value;

      // 确保面板至少 40px 可见
      const minVisible = 40;
      const minX = -origLeft + minVisible - w;
      const maxX = vw - origLeft - minVisible;
      const minY = -origTop;
      const maxY = vh - origTop - minVisible;

      newX = Math.max(minX, Math.min(maxX, newX));
      newY = Math.max(minY, Math.min(maxY, newY));
    }

    offsetX.value = newX;
    offsetY.value = newY;
  };

  const onMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  // 重置位置
  const resetPosition = () => {
    offsetX.value = initialX;
    offsetY.value = initialY;
  };

  const bindHandle = () => {
    if (!containerRef.value) return;
    const handle = containerRef.value.querySelector(handleSelector) as HTMLElement | null;
    if (handle) {
      handle.style.cursor = 'move';
      handle.addEventListener('mousedown', onMouseDown);
    }
  };

  const unbindHandle = () => {
    if (!containerRef.value) return;
    const handle = containerRef.value.querySelector(handleSelector) as HTMLElement | null;
    if (handle) {
      handle.removeEventListener('mousedown', onMouseDown);
    }
  };

  // 当 containerRef 变化时自动绑定（兼容 v-if 切换）
  watch(containerRef, (newEl) => {
    if (newEl) {
      bindHandle();
    }
  }, { flush: 'post' });

  onBeforeUnmount(() => {
    unbindHandle();
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  });

  return {
    offsetX,
    offsetY,
    isDragging,
    resetPosition,
    /** 手动重新绑定（用于 v-if 切换后 DOM 重新挂载的场景） */
    rebind: bindHandle,
  };
}
