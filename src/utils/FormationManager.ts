import * as Cesium from "cesium";

/**
 * 编队类型枚举
 */
export enum FormationType {
  FOLLOW = "follow", // 跟随模式（原一字长蛇阵）
  CUBIC = "cubic", // 立体方编队
  CYLINDER = "cylinder", // 圆柱队形
}

/**
 * 编队模式枚举
 */
export enum FormationMode {
  RELATIVE = "relative", // 相对位置模式（默认）
  PATH_FOLLOW = "pathFollow", // 路径跟随模式
}

/**
 * 编队选项接口
 */
export interface FormationOptions {
  spacing?: number; // 间距(米)
  height?: number; // 高度差(米)
  radius?: number; // 圆柱/圆形队形的半径(米)
  layers?: number; // 圆柱队形的层数
  dronesPerLayer?: number; // 每层无人机数量
  highlightLeader?: boolean; // 是否高亮显示领导无人机
  mode?: FormationMode; // 编队模式
  pathDelay?: number; // 路径跟随模式下的延迟时间(秒)
  maxPathPoints?: number; // 路径记录的最大点数
  edgeCount?: number; // 边长数量

  // 新增选项，支持自定义立方体编队
  cubicWidth?: number; // 立方体宽度（X轴无人机数量）
  cubicLength?: number; // 立方体长度（Y轴无人机数量）
  cubicLayers?: number; // 立方体层数（Z轴无人机数量）

  // 预览选项
  isPreview?: boolean; // 是否为预览模式

  // 跟随模式选项
  followerCount?: number; // 跟随者数量
}

/**
 * 默认编队选项
 */
const DEFAULT_OPTIONS: FormationOptions = {
  spacing: 30, // 默认30米间距
  height: 10, // 默认10米高度差
  radius: 50, // 默认50米半径
  layers: 2, // 默认2层
  dronesPerLayer: 6, // 默认每层6架无人机
  highlightLeader: true, // 默认高亮显示领导无人机
  mode: FormationMode.RELATIVE, // 默认使用相对位置模式
  pathDelay: 2, // 默认2秒延迟
  maxPathPoints: 1000, // 默认记录1000个路径点
};

// 在适当的位置引入PathRoamingManager
import { PathRoamingManager } from "./PathRoamingManager";

/**
 * 无人机编队管理器
 * 负责处理无人机的队形排列和编队移动
 */
export class FormationManager {
  private viewer: Cesium.Viewer;
  private leaderEntity: Cesium.Entity | null = null;
  private followerEntities: Cesium.Entity[] = [];
  private relativePositions: Cesium.Cartesian3[] = [];
  private formationActive: boolean = false;
  private originalPositions: Map<string, Cesium.Cartesian3> = new Map();
  private positionCallbacks: Map<string, Cesium.CallbackProperty> = new Map();
  private orientationCallbacks: Map<string, Cesium.CallbackProperty> =
    new Map();

  // 路径跟随模式所需的属性
  private formationMode: FormationMode = FormationMode.RELATIVE;
  private formationType: FormationType = FormationType.FOLLOW; // 当前队形类型（改为跟随模式）
  private pathHistory: Array<{
    position: Cesium.Cartesian3;
    orientation: Cesium.Quaternion;
    time: Cesium.JulianDate;
  }> = [];
  private pathRecording: boolean = false;
  private pathDelay: number = DEFAULT_OPTIONS.pathDelay!;
  private maxPathPoints: number = DEFAULT_OPTIONS.maxPathPoints!;
  private preTickCallback: (() => void) | undefined;
  private clockEvent: Cesium.Event.RemoveCallback | undefined;

  // 添加领队存在性检查事件
  private leaderCheckTimer: number | null = null;

  // 添加领队路径ID属性
  private leaderPathId: string | null = null;

  /**
   * 构造函数
   * @param viewer Cesium查看器实例
   */
  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  /**
   * 应用编队队形
   * @param entityIds 实体ID数组，第一个元素为领导无人机ID
   * @param formationType 队形类型
   * @param options 队形选项
   * @param skipClearFormation 是否跳过清除现有编队（用于预览模式）
   * @returns 是否成功应用队形
   */
  public applyFormation(
    entityIds: string[],
    formationType: FormationType,
    options: FormationOptions = {},
    skipClearFormation: boolean = false
  ): boolean {
    if (entityIds.length < 2) {
      console.error("编队需要至少两个实体");
      return false;
    }

    // 限制最大无人机数量，防止系统过载 - 设置为一个较大的数值
    const MAX_ENTITIES = 500; 
    if (entityIds.length > MAX_ENTITIES) {
      console.warn(
        `当前选择了${entityIds.length}架无人机，数量较多可能影响性能`
      );
      // 不返回false，只是警告用户
    }

    // 保存队形类型
    this.formationType = formationType;

    // 合并选项
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    // 根据编队类型调整参数
    if (formationType === FormationType.FOLLOW) {
      // 跟随模式使用路径跟随模式
      mergedOptions.mode = FormationMode.PATH_FOLLOW;
      // 为了更好的跟随效果，我们确保延迟时间与间距成正比
      const spacing = mergedOptions.spacing || DEFAULT_OPTIONS.spacing!;
      // 根据间距调整延迟时间，确保合理的跟随效果
      mergedOptions.pathDelay = spacing / 30; // 30米/秒的大致平均速度

      // 保证跟随者数量合理，但不超过可用的实体数量
      if (mergedOptions.followerCount !== undefined) {
        const availableFollowers = entityIds.length - 1; // 减去1个领队
        if (mergedOptions.followerCount > availableFollowers) {
          console.warn(
            `跟随者数量(${mergedOptions.followerCount})超过可用实体数量(${availableFollowers})，将使用实际可用数量`
          );
          mergedOptions.followerCount = availableFollowers;
        }
      }
    } else if (
      formationType === FormationType.CUBIC ||
      formationType === FormationType.CYLINDER
    ) {
      // 立方体和圆柱队形修改为使用相对位置模式，确保无人机不会落后
      mergedOptions.mode = FormationMode.RELATIVE;
      // 仍保留一些历史点记录，以便处理转弯
      mergedOptions.maxPathPoints = 200;
      // 不需要设置pathDelay，因为不使用路径跟随模式
    }

    // 清理现有编队 - 添加条件，如果skipClearFormation为true则跳过
    if (!skipClearFormation) {
      this.clearFormation();
    }

    // 获取实体引用
    const entities: Cesium.Entity[] = [];
    for (const id of entityIds) {
      const entity = this.viewer.entities.getById(id);
      if (!entity) {
        console.error(`实体ID ${id} 不存在`);
        return false;
      }
      entities.push(entity);
    }

    // 设置领导无人机和跟随无人机
    this.leaderEntity = entities[0];
    this.followerEntities = entities.slice(1);

    // 添加标记属性，以便PathRoamingManager能识别编队关系
    const leaderAny = this.leaderEntity as any;
    leaderAny._formationLeader = true;
    leaderAny._formationManagerInstance = this;

    for (const follower of this.followerEntities) {
      const followerAny = follower as any;
      followerAny._formationFollower = true;
      followerAny._formationLeaderId = this.leaderEntity.id;
    }

    // 保存原始位置
    entities.forEach((entity) => {
      if (entity.position) {
        const position = entity.position.getValue(Cesium.JulianDate.now());
        if (position) {
          this.originalPositions.set(entity.id, position.clone());
        }
      }
    });

    // 生成相对位置
    this.generateFormation(formationType, mergedOptions);

    // 设置编队模式
    this.formationMode = mergedOptions.mode || FormationMode.RELATIVE;
    this.pathDelay = mergedOptions.pathDelay || DEFAULT_OPTIONS.pathDelay!;
    this.maxPathPoints =
      mergedOptions.maxPathPoints || DEFAULT_OPTIONS.maxPathPoints!;

    // 根据模式绑定实体
    if (this.formationMode === FormationMode.PATH_FOLLOW) {
      this.startPathRecording();

      // 如果是跟随模式，使用专用的绑定方法
      if (formationType === FormationType.FOLLOW) {
        this.bindEntitiesFollow();
      } else {
        this.bindEntitiesPathFollow();
      }
    } else {
      this.bindEntities();
    }

    // 高亮领导无人机
    if (mergedOptions.highlightLeader) {
      this.highlightLeaderEntity();
    }

    // 对于预览模式，应用透明效果
    if (mergedOptions.isPreview) {
      this.applyPreviewEffects();
    }

    // 启动领队存在性监控 - 预览模式下不进行领队检测
    if (!mergedOptions.isPreview) {
      this.startLeaderExistenceCheck();
    } else {
    }

    this.formationActive = true;
    this.formationType = formationType;
    return true;
  }

  /**
   * 为预览模式应用特殊效果
   */
  private applyPreviewEffects(): void {
    if (!this.leaderEntity || this.followerEntities.length === 0) return;

    // 为所有实体应用半透明效果
    const applyPreviewToEntity = (entity: Cesium.Entity) => {
      if (entity.model) {
        // 为模型添加半透明效果
        entity.model.color = new Cesium.ConstantProperty(
          Cesium.Color.WHITE.withAlpha(0.7)
        );
      }

      if (entity.billboard) {
        // 为billboard添加半透明效果
        entity.billboard.color = new Cesium.ConstantProperty(
          Cesium.Color.WHITE.withAlpha(0.7)
        );
      }

      if (entity.point) {
        // 为点添加半透明效果
        entity.point.color = new Cesium.ConstantProperty(
          Cesium.Color.WHITE.withAlpha(0.7)
        );
      }
    };

    // 应用到领队
    applyPreviewToEntity(this.leaderEntity);

    // 应用到所有跟随者
    this.followerEntities.forEach((follower) => {
      applyPreviewToEntity(follower);
    });
  }

  /**
   * 新增方法：启动领队存在性检查
   * 定期检查领队无人机是否仍然存在，如果不存在则自动解除编队
   */
  private startLeaderExistenceCheck(): void {
    if (!this.leaderEntity) return;

    this.clearLeaderCheckTimer();

    const leaderId = this.leaderEntity.id;

    // 全局暴露应急重置方法
    if (typeof window !== "undefined") {
      const windowAny = window as any;
      if (!windowAny.formationDebug) {
        windowAny.formationDebug = {};
      }
      windowAny.formationDebug.emergencyReset = () => this.emergencyReset();
    }

    // 监控间隔，单位毫秒
    const interval = 50;

    // 记录上一次的移动状态
    let lastFlyingState: boolean | null = null;

    // 递归检查函数
    const checkLeaderExists = () => {
      if (!this.formationActive) return;

      try {
        // 1. 检查领队ID是否存在
        const entityById = this.viewer.entities.getById(leaderId);

        // 2. 检查实例是否存在于集合中
        const entityInViewer = this.leaderEntity
          ? this.viewer.entities.contains(this.leaderEntity)
          : false;

        if (!entityById || !entityInViewer) {
          // 执行同步的立即清理，不使用setTimeout
          this.clearFormation();
          return;
        }

        // 3. 检查领队移动状态变化
        if (this.leaderEntity) {
          const leaderAny = this.leaderEntity as any;
          const isFlying = leaderAny._isFlying === true;

          // 如果移动状态从true变为false，解除所有跟随者的回调绑定
          if (lastFlyingState === true && isFlying === false) {

            // 对所有跟随者执行解除绑定操作，无论编队模式
            this.unbindAllFollowersCallbacks();
          }

          // 更新状态记录
          lastFlyingState = isFlying;
        }
      } catch (e) {
        // 出现任何错误都视为领队不存在
        console.error("检查领队存在性时出错:", e);
        this.clearFormation();
        return;
      }

      // 继续检查
      this.leaderCheckTimer = window.setTimeout(checkLeaderExists, interval);
    };

    // 启动定期检查
    this.leaderCheckTimer = window.setTimeout(checkLeaderExists, interval);
  }

  private clearLeaderCheckTimer(): void {
    if (this.leaderCheckTimer !== null) {
      clearTimeout(this.leaderCheckTimer);
      this.leaderCheckTimer = null;
    }
  }

  /**
   * 解除所有跟随者的回调绑定
   * 当领队停止移动时调用
   */
  private unbindAllFollowersCallbacks(): void {

    // 对所有跟随者执行解除绑定操作
    for (const follower of this.followerEntities) {
      this.unbindFollowerCallbacks(follower);
    }

    // 强制场景重新渲染
    this.viewer.scene.requestRender();
  }

  /**
   * 清除当前编队 - 增强跟随模式处理
   * @param keepCurrentPositions 是否保持当前位置（不重置到原始位置）
   */
  public clearFormation(keepCurrentPositions: boolean = false): void {
    // 如果编队未激活，直接返回
    if (!this.formationActive) {
      return;
    }


    // 立即标记编队为非活跃，阻止所有回调继续计算
    this.formationActive = false;

    try {
      // 立即取消所有回调和事件监听
      this.stopPathRecording();

      // 移除领队检查事件
      this.clearLeaderCheckTimer();

      // 获取所有跟随者当前位置和原始位置（在其他操作前先获取）
      const followerPositions = new Map<string, Cesium.Cartesian3>();
      const followerCurrentPositions = new Map<string, Cesium.Cartesian3>();
      
      for (const follower of this.followerEntities) {
        // 保存原始位置
        const originalPos = this.originalPositions.get(follower.id);
        if (originalPos) {
          followerPositions.set(follower.id, originalPos.clone());
        }
        
        // 保存当前位置
        if (keepCurrentPositions && follower.position) {
          const currentPos = follower.position.getValue(Cesium.JulianDate.now());
          if (currentPos) {
            followerCurrentPositions.set(follower.id, currentPos.clone());
          }
        }
        
        // 检查是否有临时保存的最终位置
        const followerAny = follower as any;
        if (keepCurrentPositions && followerAny._tempFinalPosition) {
          // 如果有DroneFlightManager设置的临时位置，则使用它
          const tempPos = followerAny._tempFinalPosition;
          const cartesian = Cesium.Cartesian3.fromDegrees(
            tempPos.longitude,
            tempPos.latitude,
            tempPos.height
          );
          followerCurrentPositions.set(follower.id, cartesian);
        }
      }

      // 极其重要：先解除所有回调引用，防止在重置位置时再次触发回调
      for (const follower of this.followerEntities) {
        const followerAny = follower as any;

        // 清除所有回调引用
        if (followerAny._pathCallbackProperty) {
          followerAny._pathCallbackProperty = undefined;
        }
        if (followerAny._orientationCallbackProperty) {
          followerAny._orientationCallbackProperty = undefined;
        }
        if (followerAny._sampledPositionProperty) {
          followerAny._sampledPositionProperty = undefined;
        }

        // 移除与编队相关的所有标记
        delete followerAny._followModeFollower;
        delete followerAny._formationFollower;
        delete followerAny._formationLeaderId;
      }

      // 重置跟随者的位置 - 在回调已被解除引用后执行
      for (const follower of this.followerEntities) {
        // 确定要使用的位置 - 当前位置或原始位置
        let positionToUse: Cesium.Cartesian3 | undefined;
        
        if (keepCurrentPositions) {
          // 优先使用当前位置
          positionToUse = followerCurrentPositions.get(follower.id);
          // 如果没有当前位置，则尝试使用原始位置
          if (!positionToUse) {
            positionToUse = followerPositions.get(follower.id);
          }
        } else {
          // 使用原始位置
          positionToUse = followerPositions.get(follower.id);
        }

        if (positionToUse) {
          try {
            // 先移除现有位置属性
            follower.position = undefined;
            // 然后设置新的固定位置
            follower.position = new Cesium.ConstantPositionProperty(
              positionToUse
            );
            // 清除方向
            follower.orientation = undefined;
          } catch (e) {
            console.error(`清理跟随者 ${follower.id} 时出错:`, e);
          }
        }
      }

      // 清理领队
      if (this.leaderEntity) {
        const leaderAny = this.leaderEntity as any;

        // 清理所有领队标记
        delete leaderAny._formationLeader;
        delete leaderAny._formationManagerInstance;
        delete leaderAny._pausedHeading;
        delete leaderAny._originalClockMultiplier;

        // 移除高亮效果
        if (this.leaderEntity.point) {
          this.leaderEntity.point = undefined;
        }
        if (this.leaderEntity.model) {
          this.leaderEntity.model.silhouetteColor = undefined;
          this.leaderEntity.model.silhouetteSize = undefined;
        }
        if (this.leaderEntity.billboard) {
          if (leaderAny._originalBillboardColor) {
            this.leaderEntity.billboard.color =
              leaderAny._originalBillboardColor;
            leaderAny._originalBillboardColor = undefined;
          }
        }
        if (this.leaderEntity.ellipsoid) {
          this.leaderEntity.ellipsoid = undefined;
        }
      }

      // 重置所有收集的数据
      this.leaderEntity = null;
      this.followerEntities = [];
      this.relativePositions = [];
      this.pathHistory = [];
      this.originalPositions.clear();
      this.positionCallbacks.clear();
      this.orientationCallbacks.clear();

      // 清除编队关联的路径
      this.clearFormationPath();

      // 最后，强制场景重新渲染，确保所有变更生效
      this.viewer.scene.requestRender();

    } catch (e) {
      console.error("清除编队过程中出错:", e);
      // 即使出错，也要确保标记为非活跃
      this.formationActive = false;
    }
  }

  /**
   * 特殊的检测和应急清理方法
   * 这个方法可以从控制台直接调用：window.formationDebug.emergencyReset()
   */
  public emergencyReset(): void {

    // 即使编队标记为不活跃，也强制执行清理
    const wasActive = this.formationActive;
    this.formationActive = true;

    try {
      // 先停止所有进行中的操作
      this.stopPathRecording();

      this.clearLeaderCheckTimer();

      // 记录原始位置，以防后续需要
      const originalPositionsMap = new Map<string, Cesium.Cartesian3>();
      for (const [id, pos] of this.originalPositions.entries()) {
        originalPositionsMap.set(id, pos.clone());
      }

      // 保存跟随者引用的副本，以防清理过程中集合被修改
      const followersToReset = [...this.followerEntities];

      // 首先解除所有回调绑定，断开与领队的所有关联
      for (const follower of followersToReset) {
        const followerAny = follower as any;

        // 立即解除所有回调引用
        if (followerAny._pathCallbackProperty) {
          followerAny._pathCallbackProperty = undefined;
        }
        if (followerAny._orientationCallbackProperty) {
          followerAny._orientationCallbackProperty = undefined;
        }
        if (followerAny._sampledPositionProperty) {
          followerAny._sampledPositionProperty = undefined;
        }

        // 清除所有编队相关标记
        delete followerAny._followModeFollower;
        delete followerAny._formationFollower;
        delete followerAny._formationLeaderId;

        // 清除任何可能的内部属性
        if (followerAny._internals) {
          delete followerAny._internals.pathPositionProperty;
          delete followerAny._internals.sampledPosition;
          delete followerAny._internals.callbackProperties;
        }
      }

      // 硬重置每个跟随者
      for (const follower of followersToReset) {
        try {

          // 尝试获取原始位置
          const originalPos =
            originalPositionsMap.get(follower.id) ||
            this.originalPositions.get(follower.id) ||
            (follower as any)._safeOriginalPosition;

          if (originalPos) {

            // 先解除现有位置属性
            follower.position = undefined;

            // 再设置为固定位置
            follower.position = new Cesium.ConstantPositionProperty(
              originalPos.clone()
            );

            // 清除方向
            follower.orientation = undefined;

          } else {
          }
        } catch (e) {
          console.error(`应急重置跟随者 ${follower.id} 时出错:`, e);
        }
      }

      // 重置所有管理器状态
      this.leaderEntity = null;
      this.followerEntities = [];
      this.pathHistory = [];
      this.positionCallbacks.clear();
      this.orientationCallbacks.clear();
      this.formationActive = false;

      // 强制场景重新渲染，确保所有变更生效
      this.viewer.scene.requestRender();

    } catch (e) {
      console.error("应急重置过程中出错:", e);
      // 恢复原始活跃状态
      this.formationActive = false;
    }
  }

  /**
   * 检查编队是否激活
   */
  public isFormationActive(): boolean {
    return this.formationActive;
  }

  /**
   * 获取领导无人机
   */
  public getLeaderEntity(): Cesium.Entity | null {
    return this.leaderEntity;
  }

  /**
   * 获取所有跟随无人机
   */
  public getFollowerEntities(): Cesium.Entity[] {
    return [...this.followerEntities];
  }

  /**
   * 生成编队队形
   * @param formationType 队形类型
   * @param options 队形选项
   */
  private generateFormation(
    formationType: FormationType,
    options: FormationOptions
  ): void {
    // 获取领导无人机位置
    if (!this.leaderEntity || !this.leaderEntity.position) {
      return;
    }

    const leaderPosition = this.leaderEntity.position.getValue(
      Cesium.JulianDate.now()
    );
    if (!leaderPosition) {
      return;
    }

    const entityCount = this.followerEntities.length + 1; // 包含领导无人机

    // 根据队形类型生成相对位置
    switch (formationType) {
      case FormationType.FOLLOW:
        this.generateFollowFormation(leaderPosition, entityCount, options);
        break;
      case FormationType.CUBIC:
        this.generateCubicFormation(leaderPosition, entityCount, options);
        break;
      case FormationType.CYLINDER:
        this.generateCylinderFormation(leaderPosition, entityCount, options);
        break;
      default:
    }
  }

  /**
   * 生成跟随模式队形（原一字长蛇阵）
   * @param leaderPosition 领导无人机位置
   * @param entityCount 实体数量
   * @param options 队形选项
   */
  private generateFollowFormation(
    leaderPosition: Cesium.Cartesian3,
    entityCount: number,
    options: FormationOptions
  ): void {
    const spacing = options.spacing || DEFAULT_OPTIONS.spacing!;

    // 使用options中的followerCount（如果提供），否则使用entityCount减1
    const followerCount =
      options.followerCount !== undefined
        ? options.followerCount
        : entityCount - 1;

    // 实际需要的实体总数 = 1个领队 + followerCount个跟随者
    const actualEntityCount = 1 + followerCount;

    // 获取领导无人机的航向
    const heading = this.getEntityHeading(this.leaderEntity!);

    // 转换到局部ENU坐标系
    const leaderCartographic =
      Cesium.Cartographic.fromCartesian(leaderPosition);

    // 基于航向计算偏移
    this.relativePositions = [];

    // 领导无人机位置（相对偏移为0）
    this.relativePositions.push(new Cesium.Cartesian3(0, 0, 0));

    // 计算航向的正向和垂直方向向量
    const headingRadians = Cesium.Math.toRadians(heading);
    const forwardX = Math.sin(headingRadians);
    const forwardY = Math.cos(headingRadians);

    // 对于跟随者，生成实际的空间队形（一字队列）
    for (let i = 1; i < actualEntityCount; i++) {
      // 在跟随队列中，所有无人机排成一条直线，间距随i增加
      const distance = i * spacing;
      
      // 在领队后方排列无人机，使用固定的东北天坐标系
      // 注意：我们不使用航向来旋转，而是使用固定的东北方向
      // x: 向东为正，y: 向北为正，z: 向上为正
      
      // 在东北天坐标系中，我们将无人机排列在北方向上（即y轴正方向）
      const x = 0; // 不偏移东西方向
      const y = -distance; // 向南方向排列（领队后方）
      const z = 0; // 同一高度

      this.relativePositions.push(new Cesium.Cartesian3(x, y, z));
    }


    // 对于跟随模式，强制使用路径跟随模式
    this.formationMode = FormationMode.PATH_FOLLOW;
  }

  /**
   * 生成立体方编队
   * @param centerPosition 中心位置
   * @param entityCount 实体数量
   * @param options 队形选项
   */
  private generateCubicFormation(
    centerPosition: Cesium.Cartesian3,
    entityCount: number,
    options: FormationOptions
  ): void {
    const spacing = options.spacing || DEFAULT_OPTIONS.spacing!;

    // 判断是否使用新的自定义宽高层参数
    if (options.cubicWidth && options.cubicLength && options.cubicLayers) {
      // 使用自定义立方体参数
      this.generateCustomCubicFormation(
        centerPosition,
        entityCount,
        options.cubicWidth,
        options.cubicLength,
        options.cubicLayers,
        spacing
      );
      return;
    }

    // 以下是原来的代码，使用边长计算
    // 使用设置的边长数量或计算一个合适的值
    const edgeCount = options.edgeCount || Math.ceil(Math.cbrt(entityCount));

    // 确保edgeCount至少为2
    const dim = Math.max(2, edgeCount);

    // 计算实际需要的无人机数量
    const requiredCount = Math.pow(dim, 3);

    // 如果实际无人机数量少于需要的数量，发出警告
    if (entityCount < requiredCount) {
      console.warn(
        `立方体编队需要${requiredCount}架无人机，但只有${entityCount}架`
      );
    }

    this.relativePositions = [];

    // 计算中心点偏移，使领导无人机位于几何中心
    const centerOffset = ((dim - 1) / 2) * spacing;

    // 生成三维网格位置
    for (let x = 0; x < dim; x++) {
      for (let y = 0; y < dim; y++) {
        for (let z = 0; z < dim; z++) {
          // 计算相对于中心的偏移
          const eastOffset = (x - (dim - 1) / 2) * spacing;
          const northOffset = (y - (dim - 1) / 2) * spacing;
          const upOffset = (z - (dim - 1) / 2) * spacing;

          this.relativePositions.push(
            new Cesium.Cartesian3(eastOffset, northOffset, upOffset)
          );

          // 如果已经有足够的位置，退出循环
          if (this.relativePositions.length >= entityCount) {
            break;
          }
        }
        if (this.relativePositions.length >= entityCount) {
          break;
        }
      }
      if (this.relativePositions.length >= entityCount) {
        break;
      }
    }

    // 如果没有足够的位置，补充到所需数量
    while (this.relativePositions.length < entityCount) {
      this.relativePositions.push(new Cesium.Cartesian3(0, 0, 0));
    }

    // 找出最接近中心的位置索引
    let centerIndex = 0;
    let minDistanceSquared = Number.MAX_VALUE;

    for (let i = 0; i < this.relativePositions.length; i++) {
      const pos = this.relativePositions[i];
      const distSquared = pos.x * pos.x + pos.y * pos.y + pos.z * pos.z;

      if (distSquared < minDistanceSquared) {
        minDistanceSquared = distSquared;
        centerIndex = i;
      }
    }

    // 如果中心索引不是0，交换位置使领队在中心
    if (centerIndex !== 0) {
      const temp = this.relativePositions[0];
      this.relativePositions[0] = this.relativePositions[centerIndex];
      this.relativePositions[centerIndex] = temp;
    }
  }

  /**
   * 生成自定义尺寸的立方体编队
   * @param centerPosition 中心位置
   * @param entityCount 实体数量
   * @param width X轴无人机数量
   * @param length Y轴无人机数量
   * @param layers Z轴无人机数量（层数）
   * @param spacing 间距(米)
   */
  private generateCustomCubicFormation(
    centerPosition: Cesium.Cartesian3,
    entityCount: number,
    width: number,
    length: number,
    layers: number,
    spacing: number
  ): void {
    // 计算实际需要的无人机数量
    const requiredCount = width * length * layers;

    // 如果实际无人机数量少于需要的数量，发出警告
    if (entityCount < requiredCount) {
      console.warn(
        `自定义立方体编队需要${requiredCount}架无人机，但只有${entityCount}架`
      );
    }

    this.relativePositions = [];

    // 生成三维网格位置
    for (let z = 0; z < layers; z++) {
      for (let y = 0; y < length; y++) {
        for (let x = 0; x < width; x++) {
          // 计算相对于中心的偏移
          const eastOffset = (x - (width - 1) / 2) * spacing;
          const northOffset = (y - (length - 1) / 2) * spacing;
          const upOffset = (z - (layers - 1) / 2) * spacing;

          this.relativePositions.push(
            new Cesium.Cartesian3(eastOffset, northOffset, upOffset)
          );

          // 如果已经有足够的位置，退出循环
          if (this.relativePositions.length >= entityCount) {
            break;
          }
        }
        if (this.relativePositions.length >= entityCount) {
          break;
        }
      }
      if (this.relativePositions.length >= entityCount) {
        break;
      }
    }

    // 如果没有足够的位置，补充到所需数量
    while (this.relativePositions.length < entityCount) {
      this.relativePositions.push(new Cesium.Cartesian3(0, 0, 0));
    }

    // 找出最接近中心的位置索引
    let centerIndex = 0;
    let minDistanceSquared = Number.MAX_VALUE;

    for (let i = 0; i < this.relativePositions.length; i++) {
      const pos = this.relativePositions[i];
      const distSquared = pos.x * pos.x + pos.y * pos.y + pos.z * pos.z;

      if (distSquared < minDistanceSquared) {
        minDistanceSquared = distSquared;
        centerIndex = i;
      }
    }

    // 如果中心索引不是0，交换位置使领队在中心
    if (centerIndex !== 0) {
      const temp = this.relativePositions[0];
      this.relativePositions[0] = this.relativePositions[centerIndex];
      this.relativePositions[centerIndex] = temp;
    }
  }

  /**
   * 生成圆柱队形
   * @param centerPosition 中心位置
   * @param entityCount 实体数量
   * @param options 队形选项
   */
  private generateCylinderFormation(
    centerPosition: Cesium.Cartesian3,
    entityCount: number,
    options: FormationOptions
  ): void {
    const radius = options.radius || DEFAULT_OPTIONS.radius!;
    const height = options.height || DEFAULT_OPTIONS.height!;

    // 使用dronesPerLayer参数和layers参数
    const dronesPerLayer =
      options.dronesPerLayer || DEFAULT_OPTIONS.dronesPerLayer!;
    const totalLayers = options.layers || DEFAULT_OPTIONS.layers!;

    this.relativePositions = [];

    // 领导无人机位于圆柱中心，稍微靠下一点
    // 将领导无人机放置在所有层的垂直中心
    const leaderVerticalOffset = -(((totalLayers - 1) / 2) * height);
    this.relativePositions.push(
      new Cesium.Cartesian3(0, 0, leaderVerticalOffset)
    );

    // 计算所需层数（领导无人机占据第一个位置）
    const remainingDrones = entityCount - 1;

    // 如果没有剩余无人机，就不需要计算层数
    if (remainingDrones <= 0) {
      return;
    }

    // 开始放置无人机
    let droneIndex = 1; // 从1开始，因为领导无人机已经占据了索引0

    // 按层分配无人机
    for (
      let layer = 0;
      layer < totalLayers && droneIndex < entityCount;
      layer++
    ) {
      // 当前层的高度，向上依次增加
      const layerHeight = layer * height;

      // 当前层要放置的无人机数量
      const dronesToPlace = Math.min(dronesPerLayer, entityCount - droneIndex);

      // 在当前层环形放置无人机
      for (let i = 0; i < dronesToPlace; i++) {
        // 计算角度均匀分布在圆周上
        const angle = (i * 2 * Math.PI) / dronesToPlace;

        // 计算在圆柱表面的东北方向偏移
        const eastOffset = radius * Math.cos(angle);
        const northOffset = radius * Math.sin(angle);

        // 添加无人机位置，加上垂直偏移量保持领导无人机在垂直中心
        this.relativePositions.push(
          new Cesium.Cartesian3(
            eastOffset,
            northOffset,
            layerHeight + leaderVerticalOffset
          )
        );

        droneIndex++;
      }
    }

    // 如果没有足够的位置，补充到所需数量
    while (this.relativePositions.length < entityCount) {
      this.relativePositions.push(new Cesium.Cartesian3(0, 0, 0));
    }
  }

  /**
   * 绑定实体到队形中
   */
  private bindEntities(): void {
    if (!this.leaderEntity || this.followerEntities.length === 0) {
      return;
    }

    // 确保有相应数量的相对位置
    if (this.relativePositions.length < this.followerEntities.length + 1) {
      console.error("相对位置数量不足");
      return;
    }

    // 绑定领导无人机（不变，保持原位置）
    // 第一个相对位置（0,0,0）对应领导无人机

    // 绑定跟随无人机
    for (let i = 0; i < this.followerEntities.length; i++) {
      const follower = this.followerEntities[i];
      const relativePosition = this.relativePositions[i + 1]; // i+1 因为索引0给了leader

      // 保存原始位置用于恢复
      const originalPosition = this.originalPositions.get(follower.id);

      // 创建位置回调，增强存在性检查
      const positionCallback = new Cesium.CallbackProperty((time) => {
        // 立即检查编队是否活跃和领队是否存在
        if (
          !this.formationActive ||
          !this.leaderEntity ||
          !this.viewer.entities.contains(this.leaderEntity)
        ) {
          return originalPosition;
        }

        if (!this.leaderEntity || !this.leaderEntity.position)
          return originalPosition;

        // 获取领导无人机的位置和方向
        const leaderPosition = this.leaderEntity.position.getValue(time);
        if (!leaderPosition) return originalPosition;

        const leaderCartographic =
          Cesium.Cartographic.fromCartesian(leaderPosition);
        const leaderHeading = this.getEntityHeading(this.leaderEntity);

        // 计算局部ENU坐标系下的位置
        return this.computeFollowerPosition(
          leaderPosition,
          leaderCartographic,
          leaderHeading,
          relativePosition
        );
      }, false);

      // 创建方向回调，增强存在性检查
      const orientationCallback = new Cesium.CallbackProperty((time) => {
        // 立即检查编队是否活跃和领队是否存在
        if (
          !this.formationActive ||
          !this.leaderEntity ||
          !this.viewer.entities.contains(this.leaderEntity)
        ) {
          return null;
        }

        if (!this.leaderEntity || !this.leaderEntity.orientation) return null;

        // 获取当前领导无人机的方向
        const leaderOrientation = this.leaderEntity.orientation.getValue(time);
        if (!leaderOrientation) return null;

        // 确保跟随无人机使用与领导无人机完全相同的方向
        return leaderOrientation;
      }, false);

      // 保存回调引用
      this.positionCallbacks.set(follower.id, positionCallback);
      this.orientationCallbacks.set(follower.id, orientationCallback);

      // 应用回调
      follower.position = positionCallback as any;
      follower.orientation = orientationCallback as any;

      // 保存回调引用到实体上，方便清理
      const followerAny = follower as any;
      followerAny._pathCallbackProperty = positionCallback;
      followerAny._orientationCallbackProperty = orientationCallback;
    }
  }

  /**
   * 跟随模式特有的实体绑定方法
   */
  private bindEntitiesFollow(): void {
    if (!this.leaderEntity || this.followerEntities.length === 0) {
      return;
    }

    const followerCount = this.followerEntities.length;
    const leaderId = this.leaderEntity.id; // 缓存领队ID用于检查

    // 检查是否为预览模式
    const isPreviewMode = this.formationActive === false;

    // 为每个跟随无人机设置位置和方向回调
    for (let i = 0; i < followerCount; i++) {
      const follower = this.followerEntities[i];
      const relativePosition = this.relativePositions[i + 1]; // i+1 因为索引0给了leader

      // 保存原始位置用于初始状态和当领队被删除时
      const originalPosition = this.originalPositions.get(follower.id);
      if (!originalPosition) {
        console.error(`无法获取无人机 ${follower.id} 的原始位置`);
        continue;
      }

      // 创建固定位置的副本，防止引用被修改
      const safeOriginalPosition = originalPosition.clone();

      // 创建位置回调 - 跟随模式专用
      const positionCallback = new Cesium.CallbackProperty((time) => {
        // 1. 严格检查编队是否活跃
        if (!this.formationActive) {
          return safeOriginalPosition;
        }

        // 2. 严格检查领队是否存在 - 多重检查
        if (!this.leaderEntity) {

          // 立即解除编队状态
          if (this.formationActive) {
            // 使用异步但优先级很高的立即执行
            queueMicrotask(() => this.clearFormation());
          }

          return safeOriginalPosition;
        }

        // 3. 检查领队ID是否变化
        if (this.leaderEntity.id !== leaderId) {

          if (this.formationActive) {
            queueMicrotask(() => this.clearFormation());
          }

          return safeOriginalPosition;
        }

        // 4. 检查领队是否还在实体集合中
        if (
          !this.viewer.entities.getById(leaderId) ||
          !this.viewer.entities.contains(this.leaderEntity)
        ) {

          // 主动触发清理，因为领队已被删除
          if (this.formationActive) {
            queueMicrotask(() => this.clearFormation());
          }

          return safeOriginalPosition;
        }

        // 6. 检查领队位置属性是否存在
        if (!this.leaderEntity.position) {
          return safeOriginalPosition;
        }

        // 如果时间未定义，返回原始位置
        if (!time) {
          return safeOriginalPosition;
        }

        try {
          // 获取领导无人机的位置
          const leaderPosition = this.leaderEntity.position.getValue(time);
          if (!leaderPosition) {
            return safeOriginalPosition;
          }

          // 无论是否为预览模式，都应用相对位置偏移
          const leaderCartographic =
            Cesium.Cartographic.fromCartesian(leaderPosition);
          const leaderHeading = this.getEntityHeading(this.leaderEntity);

          // 使用computeFollowerPosition方法计算跟随者的位置
          return this.computeFollowerPosition(
            leaderPosition,
            leaderCartographic,
            leaderHeading,
            relativePosition
          );
        } catch (e) {
          console.error(`[跟随模式] 计算位置时出错:`, e);
          return safeOriginalPosition;
        }
      }, false);

      // 创建方向回调 - 跟随模式专用
      const orientationCallback = new Cesium.CallbackProperty((time) => {
        // 严格检查领队存在性和编队有效性 - 与位置回调相同的检查
        if (!this.formationActive) {
          return null;
        }

        // 多重检查领队存在性
        if (
          !this.leaderEntity ||
          this.leaderEntity.id !== leaderId ||
          !this.viewer.entities.contains(this.leaderEntity)
        ) {
          // 如果领队不存在，不需要再次触发清理（位置回调已经会处理）
          return null;
        }

        // 如果时间未定义，返回null
        if (!time) {
          return null;
        }

        // 获取当前时间点的方向（不再使用延迟）
        if (this.leaderEntity.orientation) {
          return this.leaderEntity.orientation.getValue(time);
        }

        return null;
      }, false);

      // 保存回调引用
      this.positionCallbacks.set(follower.id, positionCallback);
      this.orientationCallbacks.set(follower.id, orientationCallback);

      // 应用回调
      follower.position = positionCallback as any;
      follower.orientation = orientationCallback as any;

      // 保存回调引用到实体上，方便清理
      const followerAny = follower as any;
      followerAny._pathCallbackProperty = positionCallback;
      followerAny._orientationCallbackProperty = orientationCallback;

      // 添加特殊标记，表明这是跟随模式的跟随者
      followerAny._followModeFollower = true;
      followerAny._originalPosition = safeOriginalPosition;

      // 增加一个安全保障，存储回调创建时的原始位置
      followerAny._safeOriginalPosition = safeOriginalPosition.clone();

    }
  }

  /**
   * 解除单个跟随者的回调绑定并恢复原始位置
   * @param follower 需要解除绑定的跟随者实体
   */
  private unbindFollowerCallbacks(follower: Cesium.Entity): void {
    try {
      const followerAny = follower as any;
      const followerId = follower.id;
      const safeOriginalPosition =
        followerAny._safeOriginalPosition ||
        this.originalPositions.get(followerId);

      if (!safeOriginalPosition) {
        console.error(
          `[unbindFollowerCallbacks] 无法获取无人机 ${followerId} 的原始位置`
        );
        return;
      }


      // 保存回调引用以备将来可能需要恢复
      const posCallback = this.positionCallbacks.get(followerId);
      const orientCallback = this.orientationCallbacks.get(followerId);

      if (posCallback) {
        followerAny._cachedPathCallback = posCallback;
      }

      if (orientCallback) {
        followerAny._cachedOrientCallback = orientCallback;
      }

      // 重要：先清除引用，再设置新值，避免干扰
      follower.position = undefined;
      follower.orientation = undefined;

      // 设置为原始位置
      follower.position = new Cesium.ConstantPositionProperty(
        safeOriginalPosition
      );

      // 清除实体上的回调引用
      followerAny._pathCallbackProperty = undefined;
      followerAny._orientationCallbackProperty = undefined;

      // 从管理器中移除回调引用，但不删除实体特有标记
      // 这样如果领队恢复移动，还可以识别和重新绑定
      this.positionCallbacks.delete(followerId);
      this.orientationCallbacks.delete(followerId);


      // 强制渲染一次，确保位置更新
      this.viewer.scene.requestRender();
    } catch (e) {
      console.error(`解除跟随者 ${follower.id} 回调绑定时出错:`, e);
    }
  }

  /**
   * 获取跟随模式下指定时间点的历史位置
   * @param time 指定时间
   * @param defaultPosition 默认位置（如无法确定历史位置）
   */
  private getFollowPositionAtTime(
    time: Cesium.JulianDate,
    defaultPosition: Cesium.Cartesian3 | undefined
  ): Cesium.Cartesian3 | undefined {
    // 安全检查 - 严格检查领队存在性和编队活跃状态
    if (!this.formationActive) {
      return defaultPosition;
    }

    if (!this.leaderEntity) {
      return defaultPosition;
    }

    // 双重检查领队是否仍存在于实体集合中
    const leaderId = this.leaderEntity.id;
    if (
      !this.viewer.entities.getById(leaderId) ||
      !this.viewer.entities.contains(this.leaderEntity)
    ) {

      // 主动触发清理，不使用setTimeout，使用更高优先级的异步机制
      if (this.formationActive) {
        queueMicrotask(() => this.clearFormation());
      }

      return defaultPosition;
    }

    // 如果路径历史为空，直接返回默认位置
    if (this.pathHistory.length === 0) {
      return defaultPosition;
    }

    try {
      // 如果请求的时间早于记录的最早时间，使用最早的记录
      if (Cesium.JulianDate.lessThan(time, this.pathHistory[0].time)) {
        return this.pathHistory[0].position.clone();
      }

      // 如果请求的时间晚于记录的最晚时间，使用最新的记录
      if (
        Cesium.JulianDate.greaterThan(
          time,
          this.pathHistory[this.pathHistory.length - 1].time
        )
      ) {
        return this.pathHistory[this.pathHistory.length - 1].position.clone();
      }

      // 寻找时间点前后的两个历史记录
      let beforeIndex = -1;
      for (let i = 0; i < this.pathHistory.length - 1; i++) {
        if (
          Cesium.JulianDate.lessThanOrEquals(this.pathHistory[i].time, time) &&
          Cesium.JulianDate.greaterThanOrEquals(
            this.pathHistory[i + 1].time,
            time
          )
        ) {
          beforeIndex = i;
          break;
        }
      }

      if (beforeIndex === -1) {
        return defaultPosition;
      }

      const before = this.pathHistory[beforeIndex];
      const after = this.pathHistory[beforeIndex + 1];

      // 额外检查位置有效性
      if (!before.position || !after.position) {
        return defaultPosition;
      }

      // 计算插值因子
      const factor =
        Cesium.JulianDate.secondsDifference(time, before.time) /
        Cesium.JulianDate.secondsDifference(after.time, before.time);

      // 位置插值
      const interpolatedPosition = new Cesium.Cartesian3();
      Cesium.Cartesian3.lerp(
        before.position,
        after.position,
        factor,
        interpolatedPosition
      );

      // 最后一次安全检查 - 确认领队仍然存在
      if (
        !this.viewer.entities.getById(leaderId) ||
        !this.viewer.entities.contains(this.leaderEntity)
      ) {

        // 主动触发清理
        if (this.formationActive) {
          queueMicrotask(() => this.clearFormation());
        }

        return defaultPosition;
      }

      return interpolatedPosition;
    } catch (e) {
      console.error(`[getFollowPositionAtTime] 计算插值位置时出错:`, e);
      return defaultPosition;
    }
  }

  /**
   * 获取跟随模式下指定时间点的历史方向
   * @param time 指定时间
   */
  private getFollowOrientationAtTime(
    time: Cesium.JulianDate
  ): Cesium.Quaternion | null {
    // 安全检查
    if (!this.formationActive || !this.leaderEntity) {
      return null;
    }

    if (this.pathHistory.length === 0) {
      return null;
    }

    // 如果请求的时间早于记录的最早时间，使用最早的记录
    if (Cesium.JulianDate.lessThan(time, this.pathHistory[0].time)) {
      return this.pathHistory[0].orientation.clone();
    }

    // 如果请求的时间晚于记录的最晚时间，使用最新的记录
    if (
      Cesium.JulianDate.greaterThan(
        time,
        this.pathHistory[this.pathHistory.length - 1].time
      )
    ) {
      return this.pathHistory[this.pathHistory.length - 1].orientation.clone();
    }

    // 寻找时间点前后的两个历史记录
    let beforeIndex = -1;
    for (let i = 0; i < this.pathHistory.length - 1; i++) {
      if (
        Cesium.JulianDate.lessThanOrEquals(this.pathHistory[i].time, time) &&
        Cesium.JulianDate.greaterThanOrEquals(
          this.pathHistory[i + 1].time,
          time
        )
      ) {
        beforeIndex = i;
        break;
      }
    }

    if (beforeIndex === -1) {
      return null;
    }

    const before = this.pathHistory[beforeIndex];
    const after = this.pathHistory[beforeIndex + 1];

    // 计算插值因子
    const factor =
      Cesium.JulianDate.secondsDifference(time, before.time) /
      Cesium.JulianDate.secondsDifference(after.time, before.time);

    // 方向插值（球面线性插值）
    const result = new Cesium.Quaternion();
    Cesium.Quaternion.slerp(
      before.orientation,
      after.orientation,
      factor,
      result
    );

    return result;
  }

  /**
   * 开始记录领导无人机的路径
   */
  private startPathRecording(): void {
    // 清空历史路径
    this.pathHistory = [];
    this.pathRecording = true;

    // 设置时钟事件监听
    const onTick = () => {
      if (!this.pathRecording || !this.leaderEntity) return;

      const time = this.viewer.clock.currentTime;
      const position = this.leaderEntity.position?.getValue(time);
      const orientation = this.leaderEntity.orientation?.getValue(time);

      if (position && orientation) {
        // 添加当前位置和方向到历史记录
        this.pathHistory.push({
          position: position.clone(),
          orientation: orientation.clone(),
          time: Cesium.JulianDate.clone(time),
        });

        // 限制历史记录大小
        if (this.pathHistory.length > this.maxPathPoints) {
          this.pathHistory.shift();
        }
      }
    };

    // 添加到时钟预更新事件
    this.preTickCallback = onTick;
    this.clockEvent = this.viewer.clock.onTick.addEventListener(onTick);
  }

  /**
   * 停止记录领导无人机的路径
   */
  private stopPathRecording(): void {
    this.pathRecording = false;
    // 不要清空pathHistory，这样在暂停后仍能访问历史数据
    // this.pathHistory = [];

    // 移除时钟事件监听
    if (this.clockEvent) {
      this.clockEvent();
      this.clockEvent = undefined;
    }
  }

  /**
   * 路径跟随模式下的实体绑定
   */
  private bindEntitiesPathFollow(): void {
    if (!this.leaderEntity || this.followerEntities.length === 0) {
      return;
    }

    const followerCount = this.followerEntities.length;

    // 为每个跟随无人机设置对应的延迟时间
    for (let i = 0; i < followerCount; i++) {
      const follower = this.followerEntities[i];
      const relativePosition = this.relativePositions[i + 1]; // 用于横向偏移

      // 保存原始位置用于初始状态和当领队被删除时
      const originalPosition = this.originalPositions.get(follower.id);

      // 计算当前跟随者的延迟时间（秒）
      const delay = (i + 1) * this.pathDelay;

      // 创建位置回调
      const positionCallback = new Cesium.CallbackProperty((time) => {
        // 添加额外的领队存在性检查
        if (
          !this.formationActive ||
          !this.leaderEntity ||
          !this.viewer.entities.contains(this.leaderEntity)
        ) {
          // 立即回到原始位置
          return originalPosition;
        }

        // 如果时间未定义或没有记录足够的历史位置，则使用原始位置
        if (!time || this.pathHistory.length < 2) {
          return originalPosition || null;
        }

        // 计算延迟后的时间
        const delayedTime = Cesium.JulianDate.addSeconds(
          time,
          -delay,
          new Cesium.JulianDate()
        );

        // 找到延迟时间对应的历史位置
        return this.getPositionAtTime(delayedTime, relativePosition);
      }, false);

      // 创建方向回调
      const orientationCallback = new Cesium.CallbackProperty((time) => {
        // 添加额外的领队存在性检查
        if (
          !this.formationActive ||
          !this.leaderEntity ||
          !this.viewer.entities.contains(this.leaderEntity)
        ) {
          return null;
        }

        // 如果时间未定义或没有记录足够的历史位置，则使用领导者的当前方向
        if (
          !time ||
          this.pathHistory.length < 2 ||
          !this.leaderEntity ||
          !this.leaderEntity.orientation
        ) {
          // 直接使用当前时间获取领导者方向，避免递归
          const currentOrientation =
            this.leaderEntity.orientation?.getValue(Cesium.JulianDate.now()) ||
            null;
          return currentOrientation;
        }

        // 计算延迟后的时间
        const delayedTime = Cesium.JulianDate.addSeconds(
          time,
          -delay,
          new Cesium.JulianDate()
        );

        // 找到延迟时间对应的历史方向
        return this.getOrientationAtTime(delayedTime);
      }, false);

      // 保存回调引用
      this.positionCallbacks.set(follower.id, positionCallback);
      this.orientationCallbacks.set(follower.id, orientationCallback);

      // 应用回调
      follower.position = positionCallback as any;
      follower.orientation = orientationCallback as any;

      // 保存回调引用到实体上，方便清理
      const followerAny = follower as any;
      followerAny._pathCallbackProperty = positionCallback;
      followerAny._orientationCallbackProperty = orientationCallback;
    }
  }

  /**
   * 高亮显示领导无人机
   */
  private highlightLeaderEntity(): void {
    if (!this.leaderEntity) return;

    // 移除现有的point属性（如果有）
    if (this.leaderEntity.point) {
      this.leaderEntity.point = undefined;
    }

    // 为模型添加Silhouette轮廓光晕
    if (this.leaderEntity.model) {
      // 如果实体有模型组件，添加Silhouette轮廓效果
      this.leaderEntity.model.silhouetteColor = new Cesium.ConstantProperty(
        Cesium.Color.BLUE.withAlpha(0.2)
      );
      this.leaderEntity.model.silhouetteSize = new Cesium.ConstantProperty(2.0);
    } else {
      // 如果没有模型，需要确保实体有某种可见组件用于高亮
      // 如果实体既没有model也没有billboard，添加一个临时的point用于高亮
      this.leaderEntity.point = new Cesium.PointGraphics({
        pixelSize: 15,
        color: Cesium.Color.BLUE,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      });
    }

    // 添加发光效果
    const leaderAny = this.leaderEntity as any;
    leaderAny._isHighlighted = true;
  }

  /**
   * 获取指定时间点的历史位置
   */
  private getPositionAtTime(
    time: Cesium.JulianDate,
    relativeOffset: Cesium.Cartesian3
  ): Cesium.Cartesian3 | null {
    // 如果历史记录为空，返回null
    if (this.pathHistory.length === 0) {
      return null;
    }

    // 如果请求的时间早于记录的最早时间，使用最早的记录
    if (Cesium.JulianDate.lessThan(time, this.pathHistory[0].time)) {
      const firstPoint = this.pathHistory[0];
      return firstPoint.position.clone();
    }

    // 如果请求的时间晚于记录的最晚时间，使用最新的记录
    if (
      Cesium.JulianDate.greaterThan(
        time,
        this.pathHistory[this.pathHistory.length - 1].time
      )
    ) {
      const lastPoint = this.pathHistory[this.pathHistory.length - 1];
      return lastPoint.position.clone();
    }

    // 寻找时间点前后的两个历史记录
    let beforeIndex = -1;
    for (let i = 0; i < this.pathHistory.length - 1; i++) {
      if (
        Cesium.JulianDate.lessThanOrEquals(this.pathHistory[i].time, time) &&
        Cesium.JulianDate.greaterThanOrEquals(
          this.pathHistory[i + 1].time,
          time
        )
      ) {
        beforeIndex = i;
        break;
      }
    }

    if (beforeIndex === -1) {
      return null;
    }

    const before = this.pathHistory[beforeIndex];
    const after = this.pathHistory[beforeIndex + 1];

    // 计算插值因子
    const factor =
      Cesium.JulianDate.secondsDifference(time, before.time) /
      Cesium.JulianDate.secondsDifference(after.time, before.time);

    // 位置插值
    const interpolatedPosition = new Cesium.Cartesian3();
    Cesium.Cartesian3.lerp(
      before.position,
      after.position,
      factor,
      interpolatedPosition
    );

    return interpolatedPosition;
  }

  /**
   * 获取指定时间点的历史方向
   */
  private getOrientationAtTime(
    time: Cesium.JulianDate
  ): Cesium.Quaternion | null {
    // 如果历史记录为空，返回null
    if (this.pathHistory.length === 0) {
      return null;
    }

    // 如果请求的时间早于记录的最早时间，使用最早的记录
    if (Cesium.JulianDate.lessThan(time, this.pathHistory[0].time)) {
      return this.pathHistory[0].orientation.clone();
    }

    // 如果请求的时间晚于记录的最晚时间，使用最新的记录
    if (
      Cesium.JulianDate.greaterThan(
        time,
        this.pathHistory[this.pathHistory.length - 1].time
      )
    ) {
      return this.pathHistory[this.pathHistory.length - 1].orientation.clone();
    }

    // 寻找时间点前后的两个历史记录
    let beforeIndex = -1;
    for (let i = 0; i < this.pathHistory.length - 1; i++) {
      if (
        Cesium.JulianDate.lessThanOrEquals(this.pathHistory[i].time, time) &&
        Cesium.JulianDate.greaterThanOrEquals(
          this.pathHistory[i + 1].time,
          time
        )
      ) {
        beforeIndex = i;
        break;
      }
    }

    if (beforeIndex === -1) {
      return null;
    }

    const before = this.pathHistory[beforeIndex];
    const after = this.pathHistory[beforeIndex + 1];

    // 计算插值因子
    const factor =
      Cesium.JulianDate.secondsDifference(time, before.time) /
      Cesium.JulianDate.secondsDifference(after.time, before.time);

    // 方向插值（球面线性插值）
    const result = new Cesium.Quaternion();
    Cesium.Quaternion.slerp(
      before.orientation,
      after.orientation,
      factor,
      result
    );

    return result;
  }

  /**
   * 获取实体的航向角
   * @param entity 要获取航向的实体
   * @returns 航向角（弧度）
   */
  private getEntityHeading(entity: Cesium.Entity): number {
    try {
      if (entity.orientation) {
        // 使用固定的当前时间获取方向，避免潜在的递归
        const orientation = entity.orientation.getValue(
          Cesium.JulianDate.now()
        );
        if (orientation) {
          // 从四元数获取航向角
          const hpr = Cesium.HeadingPitchRoll.fromQuaternion(orientation);
          return hpr.heading;
        }
      }

      // 如果实体有position属性并且是SampledPositionProperty类型
      // 尝试从移动方向计算朝向（适用于路径漫游中的实体）
      if (entity.position) {
        const positionProperty = entity.position;
        if (positionProperty instanceof Cesium.SampledPositionProperty) {
          const now = Cesium.JulianDate.now();
          // 获取当前位置和未来位置
          const currentPosition = positionProperty.getValue(now);
          const futureTime = Cesium.JulianDate.addSeconds(
            now,
            0.1,
            new Cesium.JulianDate()
          );
          const futurePosition = positionProperty.getValue(futureTime);

          if (currentPosition && futurePosition) {
            // 计算方向向量
            const direction = Cesium.Cartesian3.subtract(
              futurePosition,
              currentPosition,
              new Cesium.Cartesian3()
            );

            if (Cesium.Cartesian3.magnitude(direction) > 0.001) {
              Cesium.Cartesian3.normalize(direction, direction);

              // 获取从ECEF到ENU的转换
              const transform =
                Cesium.Transforms.eastNorthUpToFixedFrame(currentPosition);
              const inverseTransform = Cesium.Matrix4.inverse(
                transform,
                new Cesium.Matrix4()
              );

              // 将方向向量转换到ENU坐标系
              const localDirection = Cesium.Matrix4.multiplyByPointAsVector(
                inverseTransform,
                direction,
                new Cesium.Cartesian3()
              );

              // 计算水平面投影
              const horizontalDirection = new Cesium.Cartesian3(
                localDirection.x,
                localDirection.y,
                0
              );

              // 标准化
              if (Cesium.Cartesian3.magnitude(horizontalDirection) > 0.001) {
                Cesium.Cartesian3.normalize(
                  horizontalDirection,
                  horizontalDirection
                );

                // 计算航向角
                return Math.atan2(horizontalDirection.x, horizontalDirection.y);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn("获取实体航向时出错:", error);
    }

    // 如果无法从方向获取航向，则使用默认值（北向）
    return 0.0;
  }

  /**
   * 计算跟随无人机的位置
   * @param leaderPosition 领导无人机位置
   * @param leaderCartographic 领导无人机的地理坐标
   * @param leaderHeading 领导无人机的航向
   * @param relativeOffset 相对偏移
   * @returns 计算后的跟随无人机位置
   */
  private computeFollowerPosition(
    leaderPosition: Cesium.Cartesian3,
    leaderCartographic: Cesium.Cartographic,
    leaderHeading: number,
    relativeOffset: Cesium.Cartesian3
  ): Cesium.Cartesian3 {
    // 使用固定的相对位置，不随航向旋转
    // 这样可以确保跟随无人机在转弯时不会绕着领队旋转
    
    // 获取领队的位置信息
    const leaderLon = leaderCartographic.longitude;
    const leaderLat = leaderCartographic.latitude;
    const leaderHeight = leaderCartographic.height;
    
    // 地球半径（米）
    const earthRadius = 6371000;
    
    // 计算经度偏移（基于纬度圆周长的比例）
    // 注意：我们使用固定的偏移量，不随航向旋转
    const lonOffset = relativeOffset.x / (earthRadius * Math.cos(leaderLat));
    
    // 计算纬度偏移（基于地球子午线长度的比例）
    const latOffset = relativeOffset.y / earthRadius;
    
    // 计算新的经纬度
    const newLon = leaderLon + lonOffset;
    const newLat = leaderLat + latOffset;
    const newHeight = leaderHeight + relativeOffset.z;
    
    // 转换回笛卡尔坐标
    return Cesium.Cartesian3.fromRadians(newLon, newLat, newHeight);
  }

  /**
   * 将指定路径分配给编队
   * @param pathId 路径ID
   * @returns 是否成功分配
   */
  public assignPathToFormation(pathId: string): boolean {
    // 安全检查
    if (!this.formationActive || !this.leaderEntity) {
      console.error("没有激活的编队，无法分配路径");
      return false;
    }

    // 获取PathRoamingManager实例
    const pathManager = PathRoamingManager.getInstance(this.viewer);

    // 获取路径数据
    const pathData = pathManager.getPathData(pathId);
    if (!pathData) {
      console.error(`路径ID ${pathId} 不存在或无法获取路径数据`);
      return false;
    }

    // 保存当前编队的路径ID
    this.leaderPathId = pathId;

    // 为领队无人机设置路径
    const leaderEntity = this.leaderEntity;
    const leaderAny = leaderEntity as any;
    leaderAny._pathData = pathData;
    leaderAny._hasCustomPath = true;
    leaderAny._pathId = pathId;


    // 为每个跟随者无人机生成相对路径
    this.followerEntities.forEach((follower, index) => {
      // 计算与领队的相对偏移
      const offset = this.calculateRelativeOffset(index);

      // 基于领队路径和相对偏移生成跟随者路径
      const followerPath = this.generateFollowerPath(pathData, offset);

      // 设置跟随者的路径数据
      const followerAny = follower as any;
      followerAny._pathData = followerPath;
      followerAny._hasCustomPath = true;
      followerAny._isGeneratedPath = true; // 标记为生成的路径

    });

    return true;
  }

  /**
   * 计算跟随者相对于领队的偏移量
   * @param followerIndex 跟随者在编队中的索引
   * @returns 相对偏移量（米）
   */
  private calculateRelativeOffset(followerIndex: number): {
    x: number;
    y: number;
    z: number;
  } {
    // 获取当前编队中的相对位置
    const relativePos = this.relativePositions[followerIndex + 1]; // +1 因为索引0是领队

    if (!relativePos) {
      console.warn(`找不到跟随者 #${followerIndex} 的相对位置，使用默认偏移`);
      return { x: 0, y: -(followerIndex + 1) * 30, z: 0 }; // 默认向后排列，间隔30米
    }

    // 返回相对偏移（米）
    return {
      x: relativePos.x,
      y: relativePos.y,
      z: relativePos.z,
    };
  }

  /**
   * 基于领队路径和相对偏移生成跟随者路径
   * @param leaderPath 领队路径数据
   * @param offset 相对偏移量（米）
   * @returns 生成的跟随者路径
   */
  private generateFollowerPath(
    leaderPath: { longitude: number; latitude: number; height: number }[],
    offset: { x: number; y: number; z: number }
  ): { longitude: number; latitude: number; height: number }[] {
    // 创建新的路径数组
    const followerPath: {
      longitude: number;
      latitude: number;
      height: number;
    }[] = [];

    // 处理每个路径点
    for (let i = 0; i < leaderPath.length; i++) {
      const leaderPoint = leaderPath[i];

      // 计算当前点的朝向以应用正确的偏移
      let heading = 0; // 默认朝向北

      if (i < leaderPath.length - 1) {
        // 计算当前点到下一个点的朝向
        const nextPoint = leaderPath[i + 1];
        heading = this.calculateHeading(
          leaderPoint.longitude,
          leaderPoint.latitude,
          nextPoint.longitude,
          nextPoint.latitude
        );
      } else if (i > 0) {
        // 对于最后一个点，使用前一个点到当前点的朝向
        const prevPoint = leaderPath[i - 1];
        heading = this.calculateHeading(
          prevPoint.longitude,
          prevPoint.latitude,
          leaderPoint.longitude,
          leaderPoint.latitude
        );
      }

      // 应用偏移
      const offsetPoint = this.applyOffsetToPoint(
        leaderPoint.longitude,
        leaderPoint.latitude,
        leaderPoint.height,
        offset.x,
        offset.y,
        offset.z,
        heading
      );

      followerPath.push(offsetPoint);
    }

    return followerPath;
  }

  /**
   * 计算两点间的朝向角（弧度）
   * @param lon1 起点经度
   * @param lat1 起点纬度
   * @param lon2 终点经度
   * @param lat2 终点纬度
   * @returns 朝向角（弧度）
   */
  private calculateHeading(
    lon1: number,
    lat1: number,
    lon2: number,
    lat2: number
  ): number {
    // 将经纬度转换为弧度
    const lon1Rad = Cesium.Math.toRadians(lon1);
    const lat1Rad = Cesium.Math.toRadians(lat1);
    const lon2Rad = Cesium.Math.toRadians(lon2);
    const lat2Rad = Cesium.Math.toRadians(lat2);

    // 使用Cesium的方法计算朝向角
    return Cesium.Cartesian3.angleBetween(
      new Cesium.Cartesian3(
        Math.cos(lat1Rad) * Math.cos(lon1Rad),
        Math.cos(lat1Rad) * Math.sin(lon1Rad),
        Math.sin(lat1Rad)
      ),
      new Cesium.Cartesian3(
        Math.cos(lat2Rad) * Math.cos(lon2Rad),
        Math.cos(lat2Rad) * Math.sin(lon2Rad),
        Math.sin(lat2Rad)
      )
    );
  }

  /**
   * 在指定点应用偏移
   * @param longitude 原始点经度
   * @param latitude 原始点纬度
   * @param height 原始点高度
   * @param offsetX X轴偏移（米）
   * @param offsetY Y轴偏移（米）
   * @param offsetZ Z轴偏移（米）
   * @param heading 朝向角（弧度）
   * @returns 偏移后的新点
   */
  private applyOffsetToPoint(
    longitude: number,
    latitude: number,
    height: number,
    offsetX: number,
    offsetY: number,
    offsetZ: number,
    heading: number
  ): { longitude: number; latitude: number; height: number } {
    // 地球半径（米）
    const earthRadius = 6371000;

    // 不根据航向旋转偏移，直接使用原始偏移
    // 这样可以确保跟随无人机在转弯时不会绕着领队旋转
    const fixedX = offsetX;
    const fixedY = offsetY;

    // 计算经度偏移（基于纬度圆周长的比例）
    const lonOffset =
      (fixedX / (earthRadius * Math.cos(Cesium.Math.toRadians(latitude)))) *
      (180 / Math.PI);

    // 计算纬度偏移（基于地球子午线长度的比例）
    const latOffset = (fixedY / earthRadius) * (180 / Math.PI);

    // 返回新的经纬度高度
    return {
      longitude: longitude + lonOffset,
      latitude: latitude + latOffset,
      height: height + offsetZ,
    };
  }

  /**
   * 获取编队的领导无人机路径ID
   * @returns 路径ID，如果未设置则返回null
   */
  public getLeaderPathId(): string | null {
    return this.leaderPathId;
  }

  /**
   * 清除编队关联的路径
   */
  public clearFormationPath(): void {
    if (!this.formationActive) return;

    // 清除领队路径ID
    this.leaderPathId = null;

    // 清除领队无人机路径数据
    if (this.leaderEntity) {
      const leaderAny = this.leaderEntity as any;
      delete leaderAny._pathData;
      delete leaderAny._hasCustomPath;
      delete leaderAny._pathId;
    }

    // 清除所有跟随者无人机路径数据
    this.followerEntities.forEach((follower) => {
      const followerAny = follower as any;
      delete followerAny._pathData;
      delete followerAny._hasCustomPath;
      delete followerAny._isGeneratedPath;
    });

  }
}
