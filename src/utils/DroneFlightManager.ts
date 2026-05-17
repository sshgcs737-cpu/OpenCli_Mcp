import * as Cesium from "cesium";
// 导入FormationManager和相关类型
import { FormationManager, FormationType } from "./FormationManager";
import type { FormationOptions } from "./FormationManager";

/**
 * 路径位置接口
 */
export interface PathPosition {
  longitude: number;
  latitude: number;
  height: number;
}

/**
 * 移动实体接口
 */
export interface FlyingEntity {
  id: string;
  entity: Cesium.Entity;
  pathData: PathPosition[];
}

/**
 * 无人机移动管理器
 * 负责处理无人机的移动控制和路径管理
 */
export class DroneFlightManager {
  // Cesium地图查看器实例，用于操作三维场景
  private viewer: Cesium.Viewer;
  // 活动实体列表，存储所有正在移动的实体
  private activeEntities: Map<string, FlyingEntity> = new Map();
  // 位置更新回调
  private positionUpdateCallback: ((entityId: string, position: PathPosition) => void) | null = null;
  // 位置更新定时器
  private positionUpdateTimer: number | null = null;
  // 位置更新频率(毫秒)
  private positionUpdateInterval: number = 2000;
  // 存储实体最后报告的位置
  private _lastReportedPositions: Map<string, PathPosition> = new Map();
  // 报告位置的最小变化阈值（米）
  private _positionChangeThreshold: number = 2.0;
  // 移动状态变化回调
  private flightStatusCallback: ((entityIds: string[]) => void) | null = null;
  // 添加FormationManager实例引用
  private formationManager: FormationManager | null = null;

  /**
   * 构造函数
   * @param viewer Cesium地图查看器实例
   */
  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    // 初始化FormationManager
    this.formationManager = new FormationManager(viewer);
  }

  /**
   * 设置位置更新回调
   * @param callback 位置更新回调函数
   */
  public setPositionUpdateCallback(callback: (entityId: string, position: PathPosition) => void): void {
    this.positionUpdateCallback = callback;
    
    // 如果有移动中的实体，启动位置更新
    if (this.activeEntities.size > 0 && !this.positionUpdateTimer) {
      this.startPositionUpdates();
    }
  }

  /**
   * 启动位置更新定时器
   */
  private startPositionUpdates(): void {
    if (this.positionUpdateTimer) {
      clearInterval(this.positionUpdateTimer);
    }

    this.positionUpdateTimer = window.setInterval(() => {
      this.updateAllEntityPositions();
    }, this.positionUpdateInterval);
  }

  /**
   * 停止位置更新定时器
   */
  private stopPositionUpdates(): void {
    if (this.positionUpdateTimer) {
      clearInterval(this.positionUpdateTimer);
      this.positionUpdateTimer = null;
    }
  }

  /**
   * 计算两个位置之间的距离（米）
   */
  private calculateDistance(pos1: PathPosition, pos2: PathPosition): number {
    return this.calculateHorizontalDistance(
      pos1.longitude, pos1.latitude, 
      pos2.longitude, pos2.latitude
    ) + Math.abs(pos1.height - pos2.height);
  }

  /**
   * 更新所有移动实体的位置
   */
  private updateAllEntityPositions(): void {
    if (!this.positionUpdateCallback) return;

    for (const [entityId, flyingEntity] of this.activeEntities.entries()) {
      const entity = flyingEntity.entity;
      
      // 获取当前时间下的位置
      const position = entity.position?.getValue(this.viewer.clock.currentTime);
      if (!position) continue;

      // 转换为经纬度高度
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      const longitude = Cesium.Math.toDegrees(cartographic.longitude);
      const latitude = Cesium.Math.toDegrees(cartographic.latitude);
      const height = cartographic.height;

      const currentPosition: PathPosition = {
        longitude,
        latitude,
        height
      };

      // 检查是否需要更新位置
      const lastPosition = this._lastReportedPositions.get(entityId);
      let shouldUpdatePosition = !lastPosition;
      
      if (lastPosition) {
        // 计算位置变化量
        const distanceChanged = this.calculateDistance(lastPosition, currentPosition);
        shouldUpdatePosition = distanceChanged > this._positionChangeThreshold;
      }

      // 如果位置变化超过阈值，则更新位置
      if (shouldUpdatePosition) {
        // 缓存当前位置
        this._lastReportedPositions.set(entityId, {...currentPosition});
        
        try {
          // 调用回调函数，告知外部位置变化了
          this.positionUpdateCallback(entityId, currentPosition);
        } catch (error) {
          console.error('位置更新回调执行出错:', error);
        }
      }
    }
  }

  /**
   * 设置移动状态变化回调
   * @param callback 移动状态变化回调函数
   */
  public setFlightStatusCallback(callback: (entityIds: string[]) => void): void {
    this.flightStatusCallback = callback;
  }

  /**
   * 让实体按照指定路径移动
   * @param entityId 实体ID
   * @param pathData 路径数据
   * @param horizontalSpeed 水平速度(米/秒)，默认50
   * @param verticalSpeed 垂直速度(米/秒)，默认30
   * @returns 是否成功启动移动
   */
  public startFly(
    entityId: string,
    pathData: PathPosition[],
    horizontalSpeed: number = 50,
    verticalSpeed: number = 30
  ): boolean {
    // 检查路径有效性
    if (!pathData || pathData.length < 2) {
      console.error("路径点数量不足，无法移动");
      return false;
    }

    // 查找实体
    const entity = this.viewer.entities.getById(entityId);
    if (!entity) {
      console.error(`实体 ${entityId} 不存在`);
      return false;
    }

    // 检查实体是否已经在移动，如果是则先停止
    if (this.activeEntities.has(entityId)) {
      this.stopFly(entityId);
    }

    // 清除该实体缓存的位置
    this._lastReportedPositions.delete(entityId);

    const entityAny = entity as any;

    // 清除手动停止标志，允许循环路径重新循环
    if (entityAny._manualStop) {
      delete entityAny._manualStop;
    }

    // 清除上次移动残留的冻结位置
    delete entityAny._frozenPosition;
    delete entityAny._lastCallbackPosition;

    // 检查是否有传入新的路径数据 - 注意这里的逻辑修改
    // 如果传入的pathData是新路径，则更新实体的_pathData
    if (pathData) {
      // 保存新路径到实体
      entityAny._hasCustomPath = true;
      entityAny._pathData = pathData;
    }
    // 如果没有传入新路径，但实体有自定义路径，则使用实体已有的路径
    else if (entityAny._hasCustomPath && entityAny._pathData) {
      pathData = entityAny._pathData;
    }

    // 检查是否由FormationManager管理的跟随者实体
    if (entityAny._formationFollower === true) {
      
      // 检查是否有对应的领队实体
      const leaderEntityId = entityAny._formationLeaderId;
      if (leaderEntityId) {
        const leaderEntity = this.viewer.entities.getById(leaderEntityId);
        if (leaderEntity) {
          const leaderAny = leaderEntity as any;
          // 如果领队已经在移动，则跟随者会自动跟随，无需额外处理
          if (leaderAny._isFlying === true) {
            
            // 标记跟随者为移动状态
            entityAny._isFlying = true;
            
            // 将跟随者添加到活动实体列表
            this.activeEntities.set(entityId, {
              id: entityId,
              entity: entity,
              pathData: pathData
            });
            
            // 通知移动状态变化
            this.notifyFlightStatusChange();
            
            return true;
          }
        }
      }
      
      // 如果是编队的一部分且有自定义路径，使用其自定义路径
      if (!entityAny._hasCustomPath || !entityAny._pathData) {
        console.error(`编队跟随者 ${entityId} 没有有效的路径数据`);
        return false;
      }
    }

    // 获取实体当前位置 - 如果有_finalPosition（上次停止位置），则使用该位置作为起点
    let updatedPathData = [...pathData]; // 创建路径数据的副本，避免修改原始数据

    // 创建往返路径：起点→终点→起点（反向路径）
    // 检查是否为循环路径（起点和终点相同或非常接近）
    const isCircularPath = this.isCircularPath(pathData);

    if (!isCircularPath && pathData.length >= 2) {
      // 对于非循环路径，添加返回路径（终点返回到起点）
      // 反向添加路径点（不包括最后一个点，因为它已经在路径中）
      const reversePath = pathData.slice(0, -1).reverse();
      updatedPathData = [...pathData, ...reversePath];
    }

    // 创建路径采样位置
    const positionProperty = this.createPositionProperty(
      updatedPathData,
      horizontalSpeed,
      verticalSpeed
    );

    if (!positionProperty) return false;

    const pathDuration = Cesium.JulianDate.secondsDifference(
      (positionProperty as any).maxTime,
      (positionProperty as any).minTime
    );

    let timeOffset = 0;
    const savedResumeProgress = typeof entityAny._resumePathProgress === "number"
      ? entityAny._resumePathProgress
      : null;
    const savedResumePathSignature = typeof entityAny._resumePathSignature === "string"
      ? entityAny._resumePathSignature
      : null;
    const updatedPathSignature = this.buildPathSignature(updatedPathData);

    if (
      savedResumeProgress !== null &&
      savedResumePathSignature === updatedPathSignature &&
      pathDuration > 0
    ) {
      const normalizedProgress = ((savedResumeProgress % 1) + 1) % 1;
      timeOffset = normalizedProgress * pathDuration;
    } else if (entityAny._finalPosition) {
      // 兜底：没有可用的真实进度时，再根据停止位置估算偏移
      timeOffset = this.calculatePathTimeOffset(entityAny._finalPosition, updatedPathData, horizontalSpeed, verticalSpeed);
    }

    delete entityAny._finalPosition;
    delete entityAny._resumePathProgress;
    delete entityAny._resumePathSignature;

    // 保存时间偏移到实体上，供循环逻辑使用
    entityAny._pathTimeOffset = timeOffset;

    // 配置实体的移动参数
    this.configureEntityForFlight(entity, positionProperty);

    // 将实体添加到活动实体列表
    this.activeEntities.set(entityId, {
      id: entityId,
      entity: entity,
      pathData: updatedPathData, // 使用更新后的路径数据
    });

    // 设置时钟并开始移动
    this.setupClock(entity);
    this.viewer.clock.shouldAnimate = true;

    // 如果这是第一个移动的实体，启动位置更新
    if (this.activeEntities.size === 1 && this.positionUpdateCallback) {
      this.startPositionUpdates();
    }

    // 通知移动状态变化
    this.notifyFlightStatusChange();

    // 立即更新一次位置，确保初始位置正确
    setTimeout(() => {
      if (this.activeEntities.has(entityId) && this.positionUpdateCallback) {
        const pos = entity.position?.getValue(this.viewer.clock.currentTime);
        if (pos) {
          const cartographic = Cesium.Cartographic.fromCartesian(pos);
          const initialPos: PathPosition = {
            longitude: Cesium.Math.toDegrees(cartographic.longitude),
            latitude: Cesium.Math.toDegrees(cartographic.latitude),
            height: cartographic.height
          };
          this._lastReportedPositions.set(entityId, initialPos);
          this.positionUpdateCallback(entityId, initialPos);
        }
      }
    }, 200);

    return true;
  }

  /**
   * 停止指定实体的移动
   * @param entityId 要停止移动的实体ID，如果不指定则停止所有移动
   * @param restoreOriginalPosition 是否恢复原始位置，默认为false（保持当前位置）
   */
  public stopFly(entityId?: string, restoreOriginalPosition: boolean = false): void {
    if (this.activeEntities.size === 0) return;

    if (entityId) {
      // 停止特定实体的移动
      const activeEntity = this.activeEntities.get(entityId);
      if (!activeEntity) return;

      // 如果这个实体正在被跟踪，取消跟踪
      if (this.viewer.trackedEntity === activeEntity.entity) {
        this.viewer.trackedEntity = undefined;
      }

      const entity = activeEntity.entity;
      const entityAny = entity as any;

      // 在停止时获取当前位置，以便更新到topoStore
      const currentPosition = this.getCurrentEntityPosition(entity);

      if (!restoreOriginalPosition) {
        const currentPathProgress = this.getCurrentPathProgress(entity);
        if (currentPathProgress !== null) {
          entityAny._resumePathProgress = currentPathProgress;
          entityAny._resumePathSignature = this.buildPathSignature(activeEntity.pathData);
        } else {
          delete entityAny._resumePathProgress;
          delete entityAny._resumePathSignature;
        }
      } else {
        delete entityAny._resumePathProgress;
        delete entityAny._resumePathSignature;
      }

      // 立即冻结位置：先把当前 Cartesian3 存到实体上，
      // CallbackProperty 闭包检测到 _manualStop 后会返回此值，避免闪现
      if (currentPosition) {
        entityAny._frozenPosition = Cesium.Cartesian3.fromDegrees(
          currentPosition.longitude,
          currentPosition.latitude,
          currentPosition.height
        );
      } else if (entityAny._lastCallbackPosition) {
        entityAny._frozenPosition = entityAny._lastCallbackPosition.clone
          ? entityAny._lastCallbackPosition.clone()
          : entityAny._lastCallbackPosition;
      }

      // 设置手动停止标志，用于阻止循环路径继续循环
      entityAny._manualStop = true;
      if (entityAny._formationLeader === true) {
        
        // 保存所有编队成员的当前位置，防止清除编队时被重置
        if (this.formationManager) {
          // 获取所有跟随者并保存它们的ID
          const followers = this.formationManager.getFollowerEntities();
          const followerIds: string[] = [];
          
          for (const follower of followers) {
            const followerId = follower.id;
            followerIds.push(followerId);
            
            const followerPosition = this.getCurrentEntityPosition(follower);
            if (followerPosition) {
              // 临时保存位置以便清除编队后恢复
              (follower as any)._tempFinalPosition = { ...followerPosition };
            }
            
            // 清除跟随者的移动状态标记
            (follower as any)._isFlying = false;
          }
          
          // 获取FormationManager实例
          if (entityAny._formationManagerInstance) {
            // 使用FormationManager的清除方法
            entityAny._formationManagerInstance.clearFormation(true);
          } else if (this.formationManager && this.formationManager.isFormationActive()) {
            // 尝试使用当前的FormationManager
            this.formationManager.clearFormation(true);
          }
          
          // 恢复所有跟随者的最终位置而非原始位置
          for (const entity of this.viewer.entities.values) {
            const entityAny = entity as any;
            if (entityAny._tempFinalPosition && !restoreOriginalPosition) {
              const tempPosition = entityAny._tempFinalPosition;
              const cartesian = Cesium.Cartesian3.fromDegrees(
                tempPosition.longitude,
                tempPosition.latitude,
                tempPosition.height
              );
              entity.position = new Cesium.ConstantPositionProperty(cartesian);
              entityAny._finalPosition = { ...tempPosition };
              
              // 清除临时位置
              delete entityAny._tempFinalPosition;
              
              // 如果有回调，更新位置
              if (this.positionUpdateCallback) {
                this.positionUpdateCallback(entity.id, tempPosition);
              }
            }
          }
          
          // 从activeEntities中移除所有跟随者
          for (const followerId of followerIds) {
            // 移除时钟事件监听器
            const followerEntity = this.viewer.entities.getById(followerId);
            if (followerEntity) {
              const followerAny = followerEntity as any;
              if (followerAny._clockTickCallback) {
                followerAny._clockTickCallback();
                delete followerAny._clockTickCallback;
              }
            }
            
            // 清除位置缓存
            this._lastReportedPositions.delete(followerId);
            
            // 从活动实体列表中移除
            this.activeEntities.delete(followerId);
          }
        }
      }

      // 清除移动状态标记
      entityAny._isFlying = false;

      // 移除时钟事件监听器
      if (entityAny._clockTickCallback) {
        entityAny._clockTickCallback();
        delete entityAny._clockTickCallback;
      }

      if (restoreOriginalPosition) {
        // 仅当明确要求恢复原始位置时才恢复
        if (entityAny._originalPosition) {
          entity.position = entityAny._originalPosition;
        }
      } else if (currentPosition) {
        // 保持在当前位置停止 - 使用固定位置属性替换SampledPositionProperty
        const cartesian = Cesium.Cartesian3.fromDegrees(
          currentPosition.longitude,
          currentPosition.latitude,
          currentPosition.height
        );
        entity.position = new Cesium.ConstantPositionProperty(cartesian);
        
        // 保存当前位置为实体的最终位置属性，用于后续恢复
        entityAny._finalPosition = { ...currentPosition };
        
        // 向回调函数报告最终位置，确保topoStore也得到更新
        if (this.positionUpdateCallback) {
          // 等待一小段时间确保位置已应用
          setTimeout(() => {
            if (this.positionUpdateCallback) {
              // 确保多次调用时使用最新的position（而不是闭包中的）
              const finalPosition = entityAny._finalPosition || currentPosition;
              this.positionUpdateCallback(entityId, finalPosition);
            }
          }, 100);
          
          // 再次确认位置已更新 - 有时第一次更新可能不成功
          setTimeout(() => {
            if (this.positionUpdateCallback && entityAny._finalPosition) {
              this.positionUpdateCallback(entityId, entityAny._finalPosition);
            }
          }, 500);
        }
      }

      // 清除保存的原始位置
      if (entityAny._originalPosition) {
        delete entityAny._originalPosition;
      }

      if (restoreOriginalPosition) {
        delete entityAny._finalPosition;
      }

      // 清除冻结位置和回调缓存位置
      delete entityAny._frozenPosition;
      delete entityAny._lastCallbackPosition;

      // 恢复实体的原始朝向
      if (entityAny._originalOrientation) {
        entity.orientation = entityAny._originalOrientation;
        delete entityAny._originalOrientation;
      } else {
        // 如果没有保存原始朝向，则清除当前朝向
        entity.orientation = undefined;
      }

      // 移除方向和可用性
      entity.availability = undefined;

      // 清除该实体的位置缓存
      this._lastReportedPositions.delete(entityId);

      // 从活动实体列表中移除
      this.activeEntities.delete(entityId);
      
      // 如果没有移动中的实体了，停止位置更新
      if (this.activeEntities.size === 0) {
        this.stopPositionUpdates();
      }

      // 通知移动状态变化
      this.notifyFlightStatusChange();
    } else {
      // 停止所有实体的移动
      this.viewer.clock.shouldAnimate = false;
      this.viewer.trackedEntity = undefined;
      
      // 先保存所有实体的当前位置
      const currentPositions = new Map<string, PathPosition>();
      for (const [id, activeEntity] of this.activeEntities.entries()) {
        const entity = activeEntity.entity;
        const position = this.getCurrentEntityPosition(entity);
        const entityAny = entity as any;

        if (!restoreOriginalPosition) {
          const currentPathProgress = this.getCurrentPathProgress(entity);
          if (currentPathProgress !== null) {
            entityAny._resumePathProgress = currentPathProgress;
            entityAny._resumePathSignature = this.buildPathSignature(activeEntity.pathData);
          } else {
            delete entityAny._resumePathProgress;
            delete entityAny._resumePathSignature;
          }
        } else {
          delete entityAny._resumePathProgress;
          delete entityAny._resumePathSignature;
        }

        if (position) {
          currentPositions.set(id, position);
          
          // 为编队成员添加临时位置标记
          if (entityAny._formationFollower || entityAny._formationLeader) {
            entityAny._tempFinalPosition = { ...position };
          }
        }
      }

      // 检查并清除编队
      if (this.formationManager && this.formationManager.isFormationActive()) {
        this.formationManager.clearFormation(true);
      }

      // 遍历并恢复所有活动实体
      for (const [id, activeEntity] of this.activeEntities.entries()) {
        const entity = activeEntity.entity;
        const entityAny = entity as any;

        // 清除移动状态标记
        entityAny._isFlying = false;
        
        // 移除时钟事件监听器
        if (entityAny._clockTickCallback) {
          entityAny._clockTickCallback();
          delete entityAny._clockTickCallback;
        }

        // 获取当前位置 - 优先使用临时保存的位置
        let currentPosition: PathPosition | null = null;
        
        if (entityAny._tempFinalPosition && !restoreOriginalPosition) {
          currentPosition = entityAny._tempFinalPosition;
          delete entityAny._tempFinalPosition;
        } else {
          currentPosition = currentPositions.get(id) || null;
        }

        if (restoreOriginalPosition) {
          // 仅当明确要求恢复原始位置时才恢复
          if (entityAny._originalPosition) {
            entity.position = entityAny._originalPosition;
          }
        } else if (currentPosition) {
          // 保持在当前位置停止 - 使用固定位置属性替换SampledPositionProperty
          const cartesian = Cesium.Cartesian3.fromDegrees(
            currentPosition.longitude,
            currentPosition.latitude,
            currentPosition.height
          );
          entity.position = new Cesium.ConstantPositionProperty(cartesian);
          
          // 保存当前位置为实体的最终位置属性，用于后续恢复
          entityAny._finalPosition = { ...currentPosition };
          
          // 向回调函数报告最终位置，确保topoStore也得到更新
          if (this.positionUpdateCallback) {
            // 对每个实体使用单独的超时，避免同时调用过多回调
            setTimeout(() => {
              if (this.positionUpdateCallback) {
                // 确保多次调用时使用最新的position（而不是闭包中的）
                const finalPosition = entityAny._finalPosition || currentPosition;
                this.positionUpdateCallback(id, finalPosition);
              }
            }, 100);
            
            // 再次确认位置已更新 - 有时第一次更新可能不成功
            setTimeout(() => {
              if (this.positionUpdateCallback && entityAny._finalPosition) {
                this.positionUpdateCallback(id, entityAny._finalPosition);
              }
            }, 500);
          }
        }

        // 清除保存的原始位置
        if (entityAny._originalPosition) {
          delete entityAny._originalPosition;
        }

        if (restoreOriginalPosition) {
          delete entityAny._finalPosition;
        }

        // 恢复实体的原始朝向
        if (entityAny._originalOrientation) {
          entity.orientation = entityAny._originalOrientation;
          delete entityAny._originalOrientation;
        } else {
          // 如果没有保存原始朝向，则清除当前朝向
          entity.orientation = undefined;
        }

        // 移除方向和可用性
        entity.availability = undefined;
      }

      // 清空位置缓存
      this._lastReportedPositions.clear();

      // 清空活动实体列表
      this.activeEntities.clear();
      
      // 停止位置更新
      this.stopPositionUpdates();

      // 通知移动状态变化
      this.notifyFlightStatusChange();
    }
  }

  /**
   * 获取实体当前位置的经纬度高度信息
   */
  private getCurrentEntityPosition(entity: Cesium.Entity): PathPosition | null {
    if (!entity.position) return null;
    
    // 获取当前时间下的位置
    const position = entity.position.getValue(this.viewer.clock.currentTime);
    if (!position) return null;
    
    // 转换为经纬度高度
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    return {
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height
    };
  }

  private getCurrentPathProgress(entity: Cesium.Entity): number | null {
    const entityAny = entity as any;
    const flightStartTime: Cesium.JulianDate | undefined = entityAny._flightStartTime;
    const sampledPositionProperty: Cesium.SampledPositionProperty | undefined = entityAny._sampledPositionProperty;

    if (!flightStartTime || !sampledPositionProperty) return null;

    const minTime = (sampledPositionProperty as any).minTime as Cesium.JulianDate;
    const maxTime = (sampledPositionProperty as any).maxTime as Cesium.JulianDate;

    if (!minTime || !maxTime) return null;

    const pathDuration = Cesium.JulianDate.secondsDifference(maxTime, minTime);
    if (pathDuration <= 0) return null;

    const pathTimeOffset: number = entityAny._pathTimeOffset || 0;
    const elapsedTime = Cesium.JulianDate.secondsDifference(
      this.viewer.clock.currentTime,
      flightStartTime
    );
    const cycleTime = ((elapsedTime + pathTimeOffset) % pathDuration + pathDuration) % pathDuration;

    return cycleTime / pathDuration;
  }

  private buildPathSignature(pathData: PathPosition[]): string {
    return pathData
      .map((pos) => `${pos.longitude.toFixed(6)},${pos.latitude.toFixed(6)},${pos.height.toFixed(2)}`)
      .join("|");
  }

  /**
   * 暂停移动
   */
  public pauseFly(): void {
    this.viewer.clock.shouldAnimate = false;
  }

  /**
   * 继续移动
   */
  public continueFly(): void {
    this.viewer.clock.shouldAnimate = true;
  }

  /**
   * 检查实体是否正在移动
   * @param entityId 实体ID
   * @returns 是否正在移动
   */
  public isEntityFlying(entityId: string): boolean {
    return this.activeEntities.has(entityId);
  }

  /**
   * 检查是否有实体正在移动
   * @returns 是否有实体正在移动
   */
  public hasActiveFlights(): boolean {
    return this.activeEntities.size > 0;
  }

  /**
   * 获取所有正在移动的实体ID
   * @returns 正在移动的实体ID数组
   */
  public getActiveEntityIds(): string[] {
    return Array.from(this.activeEntities.keys());
  }

  /**
   * 在不中断移动的情况下更新实体速度
   * 保持当前路径进度，用新速度重建位置属性
   * @param entityId 实体ID
   * @param horizontalSpeed 新的水平速度(米/秒)
   * @param verticalSpeed 新的垂直速度(米/秒)
   * @returns 是否成功更新
   */
  public updateEntitySpeed(entityId: string, horizontalSpeed: number, verticalSpeed: number): boolean {
    const activeEntity = this.activeEntities.get(entityId);
    if (!activeEntity) return false;

    const entity = activeEntity.entity;
    const entityAny = entity as any;

    // 获取当前路径进度比例
    const flightStartTime: Cesium.JulianDate = entityAny._flightStartTime;
    const pathTimeOffset: number = entityAny._pathTimeOffset || 0;
    const sampledProp: Cesium.SampledPositionProperty = entityAny._sampledPositionProperty;

    if (!flightStartTime || !sampledProp) return false;

    const oldMinTime = (sampledProp as any).minTime as Cesium.JulianDate;
    const oldMaxTime = (sampledProp as any).maxTime as Cesium.JulianDate;
    const oldDuration = Cesium.JulianDate.secondsDifference(oldMaxTime, oldMinTime);

    // 计算当前在路径中的进度（0~1）
    const now = this.viewer.clock.currentTime;
    const elapsed = Cesium.JulianDate.secondsDifference(now, flightStartTime);
    const adjustedElapsed = elapsed + pathTimeOffset;
    const currentProgress = oldDuration > 0 ? (adjustedElapsed % oldDuration) / oldDuration : 0;

    // 用新速度重建 positionProperty
    const pathData = activeEntity.pathData;
    const newPositionProperty = this.createPositionProperty(pathData, horizontalSpeed, verticalSpeed);
    if (!newPositionProperty) return false;

    const newDuration = Cesium.JulianDate.secondsDifference(
      (newPositionProperty as any).maxTime,
      (newPositionProperty as any).minTime
    );

    // 把进度比例转换成新速度下的 timeOffset，flightStartTime 重置为 now
    const newTimeOffset = currentProgress * newDuration;
    entityAny._pathTimeOffset = newTimeOffset;
    entityAny._flightStartTime = now.clone();

    // 重新配置实体（会用新闭包替换旧的 CallbackProperty）
    this.configureEntityForFlight(entity, newPositionProperty);

    // 更新 activeEntities 中的 pathData（已经是完整往返路径，不需要再处理）
    this.activeEntities.set(entityId, {
      id: entityId,
      entity,
      pathData,
    });

    return true;
  }

  /**
   * 设置全局移动速度倍数
   * @param speedMultiplier 速度倍数（0.1-10），默认1为正常速度
   * @returns 是否成功设置速度
   */
  public setGlobalSpeedMultiplier(speedMultiplier: number): boolean {
    // 限制速度倍数范围
    const clampedSpeed = Math.max(0.1, Math.min(10, speedMultiplier));

    if (!this.viewer.clock) {
      console.error('时钟不可用');
      return false;
    }

    // 设置时钟倍速
    this.viewer.clock.multiplier = clampedSpeed;

    return true;
  }

  /**
   * 获取当前全局移动速度倍数
   * @returns 当前速度倍数
   */
  public getGlobalSpeedMultiplier(): number {
    return this.viewer.clock.multiplier;
  }

  /**
   * 启动所有有自定义路径的实体的移动
   * @returns 成功启动移动的实体ID数组
   */
  public startAllEntitiesWithPath(): string[] {
    const entitiesStarted: string[] = [];

    // 获取所有实体
    const entities = this.viewer.entities.values;

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const entityId = entity.id;
      const entityAny = entity as any;

      // 检查实体是否有自定义路径
      if (entityAny._hasCustomPath && entityAny._pathData) {
        // 获取路径数据 - 原始路径数据会在startFly中根据_finalPosition进行调整
        const pathData = entityAny._pathData;

        // 启动移动
        const success = this.startFly(
          entityId,
          pathData,
          entityAny.speed || 50,
          entityAny.verticalSpeed || 30
        );

        if (success) {
          entitiesStarted.push(entityId);
        } else {
        }
      }
    }

    return entitiesStarted;
  }

  /**
   * 配置实体的移动参数
   */
  private configureEntityForFlight(
    entity: Cesium.Entity,
    positionProperty: Cesium.SampledPositionProperty
  ): void {
    // 保存实体的原始位置，以便在移动结束后恢复
    const entityAny = entity as any;
    if (!entityAny._originalPosition) {
      entityAny._originalPosition = entity.position;
    }

    // 获取路径的时间范围
    const minTime = (positionProperty as any).minTime;
    const maxTime = (positionProperty as any).maxTime;
    const pathDuration = Cesium.JulianDate.secondsDifference(maxTime, minTime);

    // 记录飞行开始时间 - 使用当前时钟时间
    const flightStartTime = this.viewer.clock.currentTime.clone();
    entityAny._flightStartTime = flightStartTime;

    // 获取路径时间偏移（如果有）
    const pathTimeOffset = entityAny._pathTimeOffset || 0;

    // 创建一个循环位置属性包装器
    const loopingPositionProperty = new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
      // 如果已手动停止，返回冻结位置，避免闪现
      if (entityAny._manualStop && entityAny._frozenPosition) {
        return entityAny._frozenPosition;
      }

      // 计算相对于飞行开始时间的经过时间（而不是路径创建时间）
      const elapsedTime = Cesium.JulianDate.secondsDifference(time, flightStartTime);

      // 应用路径时间偏移，使节点从停止位置继续
      const adjustedElapsedTime = elapsedTime + pathTimeOffset;

      // 计算循环时间（余数）
      const cycleTime = adjustedElapsedTime % pathDuration;

      // 计算实际查询时间（在原始路径时间范围内）
      const actualTime = Cesium.JulianDate.addSeconds(
        minTime,
        cycleTime,
        new Cesium.JulianDate()
      );

      // 从原始位置属性获取位置
      const pos = positionProperty.getValue(actualTime);

      // 缓存最新位置，供停止时冻结使用
      if (pos) entityAny._lastCallbackPosition = pos;

      return pos;
    }, false);

    // 使用循环位置属性
    entity.position = loopingPositionProperty;

    // 保存原始位置属性以供朝向计算使用
    entityAny._sampledPositionProperty = positionProperty;

    // 保存原始朝向
    if (entity.orientation) {
      entityAny._originalOrientation = entity.orientation;
    }

    // 添加移动状态标记
    entityAny._isFlying = true;

    // 自动朝向移动方向，并进行模型朝向修正
    entity.orientation = new Cesium.CallbackProperty((time) => {
      // 使用原始的SampledPositionProperty计算速度朝向
      // 但需要将时间映射到循环时间
      const elapsedTime = Cesium.JulianDate.secondsDifference(time, flightStartTime);

      // 应用路径时间偏移
      const adjustedElapsedTime = elapsedTime + pathTimeOffset;

      const cycleTime = adjustedElapsedTime % pathDuration;
      const actualTime = Cesium.JulianDate.addSeconds(
        minTime,
        cycleTime,
        new Cesium.JulianDate()
      );

      // 获取速度朝向
      const velocityOrientation = new Cesium.VelocityOrientationProperty(
        positionProperty
      );
      const defaultOrientation = velocityOrientation.getValue(actualTime);

      if (!defaultOrientation) return undefined;

      // 根据实体类型应用不同的模型朝向修正
      // INODE节点在useCesiumEntities.ts中已设置180度初始朝向，需要补偿
      const nodeType = entityAny.properties?.nodeType?.getValue();
      let correctionAngle = -90; // 默认修正角度（适用于DRONE等）

      if (nodeType === 'INODE') {
        // INODE需要90度修正（因为初始朝向是180度）
        correctionAngle = 90;
      }

      const correction = Cesium.Quaternion.fromAxisAngle(
        Cesium.Cartesian3.UNIT_Z,
        Cesium.Math.toRadians(correctionAngle)
      );

      // 将修正朝向与速度朝向相乘
      const correctedOrientation = Cesium.Quaternion.multiply(
        defaultOrientation,
        correction,
        new Cesium.Quaternion()
      );

      return correctedOrientation;
    }, false);

    // 由于使用了CallbackProperty实现循环，不需要设置availability
    // 如果设置了availability，实体会在时间超出范围后消失
    // 使用飞行开始时间作为availability的起始时间，确保实体始终可见
    const timeStart = flightStartTime.clone();
    const infiniteTime = Cesium.JulianDate.addSeconds(
      timeStart,
      365 * 24 * 60 * 60, // 1年，足够长的时间
      new Cesium.JulianDate()
    );

    entity.availability = new Cesium.TimeIntervalCollection([
      new Cesium.TimeInterval({
        start: timeStart,
        stop: infiniteTime,
      }),
    ]);
  }

  /**
   * 创建路径位置属性
   */
  private createPositionProperty(
    pathData: PathPosition[],
    horizontalSpeed: number,
    verticalSpeed: number
  ): Cesium.SampledPositionProperty | null {
    if (pathData.length < 2) return null;

    // 创建采样位置属性
    const positionProperty = new Cesium.SampledPositionProperty();
    
    // 设置插值算法为Hermite插值，提供更平滑的曲线
    positionProperty.setInterpolationOptions({
      interpolationDegree: 2,
      interpolationAlgorithm: Cesium.HermitePolynomialApproximation
    });

    // 设置时间范围的起点
    const start = Cesium.JulianDate.fromDate(new Date());
    let currentTime = start.clone();

    // 计算并添加每个路径点的采样
    for (let i = 0; i < pathData.length; i++) {
      const pos = pathData[i];
      const position = Cesium.Cartesian3.fromDegrees(
        pos.longitude,
        pos.latitude,
        pos.height
      );

      // 添加当前点的采样
      positionProperty.addSample(currentTime, position);

      // 如果有下一个点，计算到下一个点的移动时间
      if (i < pathData.length - 1) {
        const nextPos = pathData[i + 1];
        const nextPosition = Cesium.Cartesian3.fromDegrees(
          nextPos.longitude,
          nextPos.latitude,
          nextPos.height
        );

        // 计算水平距离（米）
        const horizontalDistance = this.calculateHorizontalDistance(
          pos.longitude,
          pos.latitude,
          nextPos.longitude,
          nextPos.latitude
        );

        // 计算垂直距离（米）
        const verticalDistance = Math.abs(nextPos.height - pos.height);

        // 计算水平和垂直方向上所需的时间
        const horizontalTime = horizontalDistance / horizontalSpeed;
        const verticalTime = verticalDistance / verticalSpeed;

        // 取水平和垂直方向所需时间的较大值作为移动时间
        let segmentTime = Math.max(horizontalTime, verticalTime);

        // 移除最小移动时间限制，允许更流畅的插值
        // const minFlightTime = 0.2;
        // if (segmentTime < minFlightTime) {
        //   segmentTime = minFlightTime;
        // }

        // 更新时间到下一个点
        currentTime = Cesium.JulianDate.addSeconds(
          currentTime,
          segmentTime,
          new Cesium.JulianDate()
        );
      }
    }

    // 将起始和结束时间保存到位置属性中
    (positionProperty as any).minTime = start;
    (positionProperty as any).maxTime = currentTime;

    return positionProperty;
  }

  /**
   * 计算两点间的水平距离（米）
   */
  private calculateHorizontalDistance(
    lon1: number,
    lat1: number,
    lon2: number,
    lat2: number
  ): number {
    // 地球半径（米）
    const earthRadius = 6371000;

    // 将经纬度转换为弧度
    const lon1Rad = Cesium.Math.toRadians(lon1);
    const lat1Rad = Cesium.Math.toRadians(lat1);
    const lon2Rad = Cesium.Math.toRadians(lon2);
    const lat2Rad = Cesium.Math.toRadians(lat2);

    // 使用Haversine公式计算两点间的距离
    const dLat = lat2Rad - lat1Rad;
    const dLon = lon2Rad - lon1Rad;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadius * c;

    return distance;
  }

  /**
   * 设置时钟
   */
  private setupClock(entity: Cesium.Entity): void {
    const availability = entity.availability;
    if (!availability) return;

    // 获取可用性的时间范围
    const timeInterval = availability.get(0);
    if (!timeInterval) return;

    // 保存实体ID，用于在时钟事件中引用
    const entityId = entity.id;
    const entityAny = entity as any;

    // 将实体自己的起止时间保存到实体上，而不是修改全局时钟
    entityAny._pathStartTime = timeInterval.start.clone();
    entityAny._pathStopTime = timeInterval.stop.clone();

    // 只在第一次启动移动或没有其他实体移动时设置全局时钟
    if (this.activeEntities.size === 0) {
      this.viewer.clock.startTime = timeInterval.start.clone();
      this.viewer.clock.currentTime = timeInterval.start.clone();
      this.viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
    }

    // 计算所有活动实体中最晚的停止时间，设置为全局时钟的停止时间
    this.updateGlobalClockStopTime();

    // 添加时钟事件监听器，用于检测路径结束和处理手动停止
    if (!this.viewer.clock.onTick.addEventListener) {
      console.warn('Cesium clock.onTick event is not available');
      return;
    }

    // 创建时钟事件处理函数
    const tickEventRemovalCallback = this.viewer.clock.onTick.addEventListener((clock) => {
      // 获取实体
      const targetEntity = this.activeEntities.get(entityId);
      if (!targetEntity) return;

      const entity = targetEntity.entity;
      const entityAny = entity as any;

      // 检查是否为手动停止 - 如果是，立即停止该实体
      if (entityAny._manualStop) {
        // 移除这个时钟事件监听器，避免重复触发
        if (tickEventRemovalCallback) {
          tickEventRemovalCallback();
        }

        // 检查是否为编队领队
        const isFormationLeader = entityAny._formationLeader === true;

        // 停止移动但保持在当前位置
        this.stopFly(entityId, false);

        // 如果是编队领队，等待stopFly执行完毕后再次通知状态变化
        // 确保跟随者状态也被正确更新
        if (isFormationLeader) {
          // 使用setTimeout确保stopFly完全执行后再次通知状态更新
          setTimeout(() => {
            this.notifyFlightStatusChange();
          }, 100);
        }
      }

      // 对于正常移动的实体，路径会自动循环（通过CallbackProperty实现）
      // 不需要在这里进行任何循环检测或处理
    });

    // 将事件移除回调存储到实体上，以便在手动停止移动时移除
    entityAny._clockTickCallback = tickEventRemovalCallback;
  }

  /**
   * 更新全局时钟的停止时间为所有活动实体中最晚的停止时间
   */
  private updateGlobalClockStopTime(): void {
    let maxStopTime: Cesium.JulianDate | null = null;

    for (const [_, flyingEntity] of this.activeEntities.entries()) {
      const entityAny = flyingEntity.entity as any;
      const stopTime = entityAny._pathStopTime;

      if (stopTime) {
        if (!maxStopTime || Cesium.JulianDate.greaterThan(stopTime, maxStopTime)) {
          maxStopTime = stopTime;
        }
      }
    }

    // 如果找到了最大停止时间，更新全局时钟
    if (maxStopTime) {
      // 为了支持循环，设置一个足够大的停止时间
      const extendedStopTime = Cesium.JulianDate.addSeconds(
        maxStopTime,
        86400, // 增加24小时，确保有足够的时间进行循环
        new Cesium.JulianDate()
      );
      this.viewer.clock.stopTime = extendedStopTime;
    }
  }

  /**
   * 判断路径是否为圆形路径（循环路径）
   * 通过检查起点和终点是否相同或非常接近来判断
   */
  private isCircularPath(pathData: PathPosition[]): boolean {
    if (!pathData || pathData.length < 3) {
      return false;
    }

    const firstPoint = pathData[0];
    const lastPoint = pathData[pathData.length - 1];

    // 计算起点和终点之间的距离
    const distance = this.calculateHorizontalDistance(
      firstPoint.longitude,
      firstPoint.latitude,
      lastPoint.longitude,
      lastPoint.latitude
    );

    // 检查高度差
    const heightDiff = Math.abs(firstPoint.height - lastPoint.height);

    // 如果水平距离小于5米且高度差小于5米，认为是圆形路径
    return distance < 5 && heightDiff < 5;
  }

  /**
   * 计算停止位置在路径上的时间偏移
   * @param finalPosition 停止位置
   * @param pathData 路径数据
   * @param horizontalSpeed 水平速度
   * @param verticalSpeed 垂直速度
   * @returns 时间偏移（秒）
   */
  private calculatePathTimeOffset(
    finalPosition: PathPosition,
    pathData: PathPosition[],
    horizontalSpeed: number,
    verticalSpeed: number
  ): number {
    if (pathData.length < 2) return 0;

    let minDistance = Number.MAX_VALUE;
    let closestSegmentIndex = 0;
    let closestPointOnSegment: PathPosition | null = null;

    // 查找最接近的路径线段
    for (let i = 0; i < pathData.length - 1; i++) {
      const segmentStart = pathData[i];
      const segmentEnd = pathData[i + 1];

      // 计算finalPosition到这条线段的最近点
      const pointOnSegment = this.getClosestPointOnSegment(
        finalPosition,
        segmentStart,
        segmentEnd
      );

      const distance = this.calculateDistance(finalPosition, pointOnSegment);

      if (distance < minDistance) {
        minDistance = distance;
        closestSegmentIndex = i;
        closestPointOnSegment = pointOnSegment;
      }
    }

    // 计算从路径起点到最近点的时间
    let timeOffset = 0;

    // 累加前面所有线段的时间
    for (let i = 0; i < closestSegmentIndex; i++) {
      const segmentStart = pathData[i];
      const segmentEnd = pathData[i + 1];

      const horizontalDistance = this.calculateHorizontalDistance(
        segmentStart.longitude,
        segmentStart.latitude,
        segmentEnd.longitude,
        segmentEnd.latitude
      );

      const verticalDistance = Math.abs(segmentEnd.height - segmentStart.height);

      const horizontalTime = horizontalDistance / horizontalSpeed;
      const verticalTime = verticalDistance / verticalSpeed;

      timeOffset += Math.max(horizontalTime, verticalTime);
    }

    // 加上当前线段上从起点到最近点的时间
    if (closestPointOnSegment) {
      const segmentStart = pathData[closestSegmentIndex];

      const horizontalDistance = this.calculateHorizontalDistance(
        segmentStart.longitude,
        segmentStart.latitude,
        closestPointOnSegment.longitude,
        closestPointOnSegment.latitude
      );

      const verticalDistance = Math.abs(closestPointOnSegment.height - segmentStart.height);

      const horizontalTime = horizontalDistance / horizontalSpeed;
      const verticalTime = verticalDistance / verticalSpeed;

      timeOffset += Math.max(horizontalTime, verticalTime);
    }

    return timeOffset;
  }

  /**
   * 获取点到线段的最近点
   * @param point 目标点
   * @param segmentStart 线段起点
   * @param segmentEnd 线段终点
   * @returns 线段上最接近目标点的点
   */
  private getClosestPointOnSegment(
    point: PathPosition,
    segmentStart: PathPosition,
    segmentEnd: PathPosition
  ): PathPosition {
    // 将经纬度转换为局部坐标系（简化计算）
    const px = point.longitude;
    const py = point.latitude;
    const pz = point.height;

    const ax = segmentStart.longitude;
    const ay = segmentStart.latitude;
    const az = segmentStart.height;

    const bx = segmentEnd.longitude;
    const by = segmentEnd.latitude;
    const bz = segmentEnd.height;

    // 向量 AP 和 AB
    const apx = px - ax;
    const apy = py - ay;
    const apz = pz - az;

    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;

    // AB 的长度平方
    const abLengthSq = abx * abx + aby * aby + abz * abz;

    if (abLengthSq === 0) {
      // 线段退化为点
      return segmentStart;
    }

    // 计算投影参数 t = (AP · AB) / |AB|²
    const t = (apx * abx + apy * aby + apz * abz) / abLengthSq;

    // 限制 t 在 [0, 1] 范围内
    const clampedT = Math.max(0, Math.min(1, t));

    // 计算最近点
    return {
      longitude: ax + clampedT * abx,
      latitude: ay + clampedT * aby,
      height: az + clampedT * abz,
    };
  }

  /**
   * 通知移动状态变化
   */
  private notifyFlightStatusChange(): void {
    if (this.flightStatusCallback) {
      const activeIds = Array.from(this.activeEntities.keys());
      this.flightStatusCallback(activeIds);
    }
  }

  /**
   * 创建编队跟随模式
   * @param entityIds 参与编队的实体ID数组，第一个为领导无人机
   * @param pathData 领导无人机的路径数据
   * @param options 编队选项
   * @param horizontalSpeed 水平速度(米/秒)，默认50
   * @param verticalSpeed 垂直速度(米/秒)，默认30
   * @param formationType 编队类型，默认为跟随模式
   * @param startImmediately 是否立即开始移动，默认为true
   * @returns 是否成功创建编队移动
   */
  public createFormationFollow(
    entityIds: string[],
    pathData: PathPosition[],
    options: FormationOptions = {},
    horizontalSpeed: number = 50,
    verticalSpeed: number = 30,
    formationType: FormationType = FormationType.FOLLOW,
    startImmediately: boolean = true
  ): boolean {
    // 验证输入参数
    if (!entityIds || entityIds.length < 2) {
      console.error("编队移动需要至少两个实体");
      return false;
    }

    if (!pathData || pathData.length < 2) {
      console.error("路径点数量不足，无法移动");
      return false;
    }

    if (!this.formationManager) {
      console.error("FormationManager未初始化");
      return false;
    }

    // 获取领导无人机ID
    const leaderEntityId = entityIds[0];
    
    // 验证所有实体是否存在
    for (const id of entityIds) {
      const entity = this.viewer.entities.getById(id);
      if (!entity) {
        console.error(`实体 ${id} 不存在`);
        return false;
      }
      
      // 如果实体正在移动，先停止它
      if (this.activeEntities.has(id)) {
        this.stopFly(id, true); // 恢复到原始位置
      }
    }

    // 为领导无人机设置路径
    const leaderEntity = this.viewer.entities.getById(leaderEntityId) as any;
    leaderEntity._hasCustomPath = true;
    leaderEntity._pathData = pathData;


    // 应用编队队形 - 使用传入的formationType而不是硬编码的FormationType.FOLLOW
    const success = this.formationManager.applyFormation(
      entityIds,
      formationType,  // 使用传入的队形类型
      options
    );

    if (!success) {
      console.error(`应用编队队形(${formationType})失败`);
      return false;
    }

    // 如果不立即开始移动，就在这里返回
    if (!startImmediately) {
      return true;
    }

    // 启动领导无人机的移动
    const flySuccess = this.startFly(
      leaderEntityId,
      pathData,
      horizontalSpeed,
      verticalSpeed
    );

    if (!flySuccess) {
      console.error(`启动领导无人机 ${leaderEntityId} 移动失败`);
      // 清除编队
      this.formationManager.clearFormation();
      return false;
    }

    // 将所有跟随者也标记为活跃实体，以便进行位置报告和管理
    const followerEntities = this.formationManager.getFollowerEntities();
    for (const follower of followerEntities) {
      const followerId = follower.id;
      
      // 标记为移动状态
      (follower as any)._isFlying = true;
      
      // 添加到活跃实体列表
      this.activeEntities.set(followerId, {
        id: followerId,
        entity: follower,
        pathData: pathData // 使用与领导者相同的路径数据
      });
    }

    // 通知移动状态变化
    this.notifyFlightStatusChange();

    return true;
  }

  /**
   * 销毁管理器
   */
  public destroy(): void {
    // 停止所有移动
    this.stopFly();
    
    // 停止位置更新
    this.stopPositionUpdates();
    
    // 清除回调
    this.positionUpdateCallback = null;
    this.flightStatusCallback = null;
    
    // 清理FormationManager
    if (this.formationManager) {
      this.formationManager = null;
    }
  }
}
