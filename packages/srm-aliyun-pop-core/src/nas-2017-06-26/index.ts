import Pop, { Config } from "@alicloud/pop-core";
import _ from "lodash";
import { tracker } from '@serverless-cd/srm-aliyun-common';
import { requestOption, sleep } from "../utils";
import { IGetNasZonesAsVSwitchesResponse, IMakeNas } from "./type";

export * from './type';

const createMountCheckRetry = _.parseInt(process.env.CHECK_NAS_STATUS_RETRY || '40');

export default class Vpc extends Pop {
  region: string;
  logger: any;

  constructor(region: string, config: Config, logger = console) {
    super({
      ...config,
      endpoint: `http://nas.${region}.aliyuncs.com`,
      apiVersion: '2017-06-26',
    });

    this.region = region;
    this.logger = logger;
  }

  /**
   * 
   */
  async makeNas(params: IMakeNas) {
    const nasConfig = _.get(params, 'nasConfig', []);
    const { storageType, zoneId, vpcId, vswitchId, description } = params;
    if (!_.isEmpty(nasConfig)) {
      for (const fileSystem of nasConfig) {
        if (fileSystem.FileSystemType !== 'standard' || fileSystem.ZoneId !== zoneId) {
          continue;
        }
        const mountTarget = _.get(fileSystem, 'MountTargets.MountTarget', []);
        const fileSystemId = _.get(fileSystem, 'FileSystemId', '');

        if (mountTarget.length < 2) {
          try {
            const mountTargetDomain = await this.createMountTarget({
              fileSystemId,
              vpcId,
              vswitchId,
            });
            return { fileSystemId, mountTargetDomain };
          } catch (ex) {
            this.logger.error(`Failed to take nas(${fileSystemId}), error message: ${ex}`);
          }
        }
      }
    }

    // create nas
    const fileSystemId = await this.createFileSystem({
      zoneId,
      description,
      storageType,
    })
    const mountTargetDomain = await this.createMountTarget({
      fileSystemId,
      vpcId,
      vswitchId,
    });
    return { fileSystemId, mountTargetDomain };
  }

  /**
   * 根据 vpcId 和 description 查找 nas 配置
   */
  async findNas(vpcId: string, description: string): Promise<{ fileSystemId: string, mountTargetDomain: string } | any[]> {
    // 查找文件系统中使用 vpcConfig 的有效挂载点
    const expectedFileSystems = await this.describeFileSystems(description);

    // 如果查到则返回 fileSystemId 和 mountTargetDomain
    // 如果没有找到则返回第一个元素的 fileSystemId
    for (const fileSystem of expectedFileSystems) {
      const mountTarget = _.get(fileSystem, 'MountTargets.MountTarget', []);
      if (!_.isEmpty(mountTarget)) {
        for (const mountTargetItem of mountTarget) {
          // Inactive：不可用 Deleting：删除中  跳出这两个状态
          if (['Inactive', 'Deleting'].includes(mountTargetItem.Status)) continue;
          if (mountTargetItem.VpcId === vpcId) {
            return {
              fileSystemId: fileSystem.FileSystemId,
              mountTargetDomain: mountTargetItem.MountTargetDomain,
            };
          }
        }
      }
    }

    return expectedFileSystems;
  }

  /**
   * 创建文件系统
   */
  async createFileSystem(params: {
    zoneId: string;
    description: string;
    storageType: string;
  }) {
    const { zoneId, description, storageType } = params;
    const rs: any = await this.request('CreateFileSystem', {
      RegionId: this.region,
      StorageType: storageType,
      Description: description,
      ZoneId: zoneId,
      ProtocolType: 'NFS',
    }, requestOption);
    return rs.FileSystemId;
  }

  /**
   * 创建挂载点
   */
  async createMountTarget(params: {
    fileSystemId: string;
    vpcId: string;
    vswitchId: string;
  }): Promise<string> {
    const { fileSystemId, vpcId, vswitchId } = params;
    const rs: any = await this.request('CreateMountTarget', {
      RegionId: this.region,
      FileSystemId: fileSystemId,
      VpcId: vpcId,
      VSwitchId: vswitchId,
      NetworkType: 'Vpc',
      AccessGroupName: 'DEFAULT_VPC_GROUP_NAME',
    }, requestOption);
    this.logger.debug(`CreateMountTarget target response: ${JSON.stringify(rs)}`);

    const mountTargetDomain = rs.MountTargetDomain;

    await this.waitMountPointUntilAvailable(fileSystemId, mountTargetDomain);
    return mountTargetDomain;
  }

  private async waitMountPointUntilAvailable(
    fileSystemId: string,
    mountTargetDomain: string,
  ): Promise<void> {
    let count = 0;
    let status: string;

    do {
      count++;

      await sleep(2000);

      const rs: any = await this.request(
        'DescribeMountTargets',
        {
          RegionId: this.region,
          FileSystemId: fileSystemId,
          MountTargetDomain: mountTargetDomain,
        },
        requestOption,
      );
      status = _.get(rs, 'MountTargets.MountTarget[0].Status', '');
      this.logger.debug(`nas status is: ${status}`);
      this.logger.debug(`Nas mount target domain already created, waiting for status to be 'Active', now is ${status}`);
    } while (count < createMountCheckRetry && status !== 'Active');

    if (status !== 'Active') {
      throw new Error(
        `Timeout while waiting for MountPoint ${mountTargetDomain} status to be 'Active',please try again.`,
      );
    }
  }

  /**
   * 获取文件系统详情
   */
  async describeFileSystems(description: string): Promise<any[]> {
    const pageSize = 100;
    const expectedFileSystems = [];
    const needFilterDescription = !_.isEmpty(description);
    let requestPageNumber = 0;
    let totalCount: number;
    let pageNumber: number;

    do {
      const p = {
        RegionId: this.region,
        PageSize: pageSize,
        PageNumber: ++requestPageNumber,
      };

      this.logger.debug(`DescribeFileSystems request pageNumber: ${requestPageNumber}`);
      const rs: any = await this.request('DescribeFileSystems', p, requestOption);

      totalCount = rs.TotalCount;
      if (totalCount === 0) {
        return expectedFileSystems;
      }
      pageNumber = rs.PageNumber;

      const fileSystems = _.get(rs, 'FileSystems.FileSystem', []).filter((fileSystem: any) => {
        // 当前文件系统不可用/当前文件系统停机中/当前文件系统删除中 这是三个不可用的状态抛除
        if (['Stopped', 'Stopping', 'Deleting'].includes(fileSystem.Status)) return false;
        if (needFilterDescription && fileSystem.Description !== description) return false;
        return true;
      });

      this.logger.debug(`DescribeFileSystems response is: ${JSON.stringify(fileSystems)}.`);

      expectedFileSystems.push(...fileSystems);
    } while (pageNumber * pageSize < totalCount);

    this.logger.debug(`find filesystem: ${JSON.stringify(expectedFileSystems)}`);
    return expectedFileSystems;
  }

  /**
   * 获取nas可用区，优先返回Performance（性能型）、其次返回 Capacity（容量型）
   */
  async getNasZones(): Promise<{ zoneIds: string[]; type: 'Performance' | 'Capacity' }> {
    const zones = await this.describeZones();
    this.logger.debug(JSON.stringify(zones));

    const performances: string[] = [];
    const capacities: string[] = [];
    for (const zone of zones) {
      const zoneId = _.get(zone, 'ZoneId');
      const capacity = _.get(zone, 'Capacity.Protocol', []);
      const performance = _.get(zone, 'Performance.Protocol', []);
      if (!_.isEmpty(performance)) {
        performances.push(zoneId);
      }
      if (!_.isEmpty(capacity)) {
        capacities.push(zoneId);
      }
    }
    if (!_.isEmpty(performances)) {
      return { zoneIds: performances, type: 'Performance' };
    }
    if (!_.isEmpty(capacities)) {
      return { zoneIds: capacities, type: 'Capacity' };
    }
    throw new Error('Not fount nas zoneIds');
  }

  /**
   * 根据交换机详情获取可创建用区
   */
  async getNasZonesAsVSwitches(vswitches: { vswitchId: string; zoneId: string }[]): Promise<IGetNasZonesAsVSwitchesResponse> {
    const zones = await this.describeZones();
    const capacityZoneConfig = {};
    for (const { vswitchId, zoneId } of vswitches) {
      const zone = _.find(zones, (item) => item.ZoneId === zoneId);
      const capacity = _.get(zone, 'Capacity.Protocol', []);
      const performance = _.get(zone, 'Performance.Protocol', []);
      if (!_.isEmpty(performance)) {
        return {
          vswitchId,
          zoneId,
          type: 'Performance',
        }
      }
      if (!_.isEmpty(capacityZoneConfig) && !_.isEmpty(capacity)) {
        _.merge(capacityZoneConfig, {
          vswitchId,
          zoneId,
          type: 'Capacity',
        })
      }
    }
    if (!_.isEmpty(capacityZoneConfig)) {
      return capacityZoneConfig as IGetNasZonesAsVSwitchesResponse;
    }
    throw new Error('Not zone as vswitch configuration');
  }

  /**
   * 获取 nas 可用区
   */
  async describeZones(fileSystemType = 'standard'): Promise<any[]> {
    const zones = await this.request('DescribeZones', { RegionId: this.region, FileSystemType: fileSystemType }, requestOption);
    return _.get(zones, 'Zones.Zone', []);
  }

  @tracker()
  async request<T>(action: String, params: Object, options?: Object | undefined): Promise<T> {
    return await super.request(action, params, options);
  }
}

