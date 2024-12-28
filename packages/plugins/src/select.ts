import { GraphQLResolveInfo } from 'graphql';
import { DMMF } from '@paljs/types';
import { parseResolveInfo } from 'graphql-parse-resolve-info';

export interface PrismaSelectOptions<
  ModelName extends string,
  ModelsObject extends Record<ModelName, Record<string, any>>,
> {
  /*
   * you can pass an object with your models and what the fields you need
   * to include for every model even if user not requested in GraphQL query.
   * @example
   * const defaultFields = {
   *    User: { id: true, name: true },
   *    Type: { id: true, descriptionRaw: true },
   *    Post: { id: true, body: true },
   *    // as function you can check if client select some fields to add another to default fields
   *    Account: (select) => select.name ?
   * {firstname: true, lastname: true} : {}
   * }
   * */
  defaultFields?: {
    [model in ModelName]?:
      | {
          [field in keyof ModelsObject[model]]?: boolean;
        }
      | ((select: any) => { [field in keyof ModelsObject[model]]?: boolean });
  };
  /*
   * you can pass an object with your models and what the fields you need
   * to exclude for every model even if user requested in GraphQL query.
   * @example
   * const excludeFields = {
   *    User: ['id', 'name'],
   *    Type: ['id', 'descriptionRaw'],
   *    Post: ['id', 'body'],
   *    // as function you can check if client select some fields to add another to default fields
   *    Account: (select) => select.name ?
   * ['firstName', 'lastname'] : []
   * }
   * */
  excludeFields?: {
    [model in ModelName]?:
      | (keyof ModelsObject[model] | string)[]
      | ((select: any) => (keyof ModelsObject[model] | string)[]);
  };
  /*
   * array of dmmf object import from generated prisma client default
   * @example
   * import {Prisma} from './customPath';
   * import {Prisma as Prisma2} from './customPath2';
   * {
   *  dmmf: [Prisma.dmmf, Prisma2.dmmf]
   * }
   * */
  dmmf?: Pick<DMMF.Document, 'datamodel'>[];
}

/**
 * Convert `info` to select object accepted by `prisma client`.
 * @param info - GraphQLResolveInfo.
 * @example
 * // Graphql query
 * {
 *    findManyUser{
 *      id
 *      posts(where: { title: { contains: "a" } }, first: 10) {
 *        id
 *        comments{
 *          id
 *        }
 *      }
 *    }
 * }
 * // convert to
 * {
 *  select: {
 *    id: true,
 *    posts: {
 *      select: { id: true, comments: { select: { id: true } } },
 *      where: { title: { contains: "a" } },
 *      first: 10
 *    }
 *  }
 * }
 *
 * // Use
 *
 * const select = new PrismaSelect(info);
 *
 * prisma.user.findMany({
 *  ...args,
 *  ...select.value,
 * })
 *
 **/

export class PrismaSelect<
  ModelName extends string = '',
  ModelsObject extends Record<ModelName, Record<string, any>> = Record<ModelName, Record<string, any>>,
> {
  private availableArgs = ['where', 'orderBy', 'skip', 'cursor', 'take', 'distinct'];
  private allowedProps = ['_count'];
  private isAggregate = false;

  constructor(
    private info: GraphQLResolveInfo,
    private options?: PrismaSelectOptions<ModelName, ModelsObject>,
  ) {}

  get value() {
    const returnType = this.info.returnType.toString().replace(/]/g, '').replace(/\[/g, '').replace(/!/g, '');
    this.isAggregate = returnType.includes('Aggregate');
    return this.valueWithFilter(returnType);
  }

  get dataModel(): DMMF.Model[] {
    if (this.options?.dmmf) {
      const models: DMMF.Model[] = [];
      this.options?.dmmf.forEach((doc) => {
        models.push(...doc.datamodel.models);
      });
      return models;
    } else {
      const { Prisma } = require('@prisma/client');
      if (Prisma.dmmf && Prisma.dmmf.datamodel) {
        return Prisma.dmmf.datamodel.models;
      } else {
        return [];
      }
    }
  }

  get defaultFields() {
    return this.options?.defaultFields;
  }

  get excludeFields() {
    return this.options?.excludeFields;
  }

  private get fields() {
    return parseResolveInfo(this.info);
  }

  private static getModelMap(docs?: string, name?: string) {
    const value = docs?.match(/@PrismaSelect.map\(\[(.*?)]\)/);
    if (value && name) {
      const asArray = value[1]
        .replace(/ /g, '')
        .split(',')
        .filter((v) => v);
      return asArray.includes(name);
    }
    return false;
  }

  private model(name?: string) {
    return this.dataModel.find((item) => item.name === name || PrismaSelect.getModelMap(item.documentation, name));
  }

  private field(name: string, model?: DMMF.Model) {
    return model?.fields.find((item) => item.name === name);
  }

  static isObject(item: any) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  static mergeDeep(target: any, ...sources: any[]): any {
    if (!sources.length) return target;
    const source: any = sources.shift();

    if (PrismaSelect.isObject(target) && PrismaSelect.isObject(source)) {
      for (const key in source) {
        if (PrismaSelect.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          PrismaSelect.mergeDeep(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }

    return PrismaSelect.mergeDeep(target, ...sources);
  }

  /**
   * Get nested value from a select object.
   * @param field - name of field in a select object.
   * @param filterBy - Model name as you have in schema.prisma file.
   * @param mergeObject
   * @example
   * // Graphql query
   * {
   *    findManyUser{
   *      id
   *      posts{
   *        id
   *        comments{
   *          id
   *        }
   *      }
   *    }
   * }
   *
   * // when you need to get more nested fields add `.`
   * PrismaSelect.valueOf('posts.comments', 'Comment');
   * // return
   * { select: { id: true } }
   *
   * PrismaSelect.valueOf('posts', 'Post');
   *
   * // return
   * { select: { id: true, comments: { select: { id: true } } } }
   *
   **/
  valueOf(field: string, filterBy?: string, mergeObject: any = {}) {
    const splitItem = field.split('.');
    let newValue: Record<string, any> = this.getSelect(this.fields);
    for (const field of splitItem) {
      if (this.isAggregate && Object.prototype.hasOwnProperty.call(newValue, field)) {
        newValue = newValue[field];
      } else if (
        !this.isAggregate &&
        Object.prototype.hasOwnProperty.call(newValue, 'select') &&
        Object.prototype.hasOwnProperty.call(newValue.select, field)
      ) {
        newValue = newValue.select[field];
      } else {
        return {};
      }
    }
    return filterBy ? PrismaSelect.mergeDeep(this.filterBy(filterBy, newValue), mergeObject) : newValue;
  }

  /**
   * Work with this method if your GraphQL type name not like Schema model name.
   * @param modelName - Model name as you have in schema.prisma file.
   * @example
   * // normal call
   * const select = new PrismaSelect(info).value
   *
   * // With filter will filter select object with provided schema model name
   * const select = new PrismaSelect(info).valueWithFilter('User');
   *
   **/
  valueWithFilter(modelName: string) {
    return this.filterBy(modelName, this.getSelect(this.fields));
  }

  private filterBy(modelName: string, selectObject: any) {
    const model = this.model(modelName);
    if (model && typeof selectObject === 'object') {
      let defaultFields = {};
      if (this.defaultFields && this.defaultFields[modelName]) {
        const modelFields = this.defaultFields[modelName];
        defaultFields = typeof modelFields === 'function' ? modelFields(selectObject.select) : modelFields;
      }
      const filteredObject = {
        ...selectObject,
        select: { ...defaultFields },
      };

      for (const key in selectObject.select) {
        if (this.excludeFields && this.excludeFields[modelName]) {
          const modelFields = this.excludeFields[modelName];
          const excludeFields = typeof modelFields === 'function' ? modelFields(selectObject.select) : modelFields;
          if (excludeFields.includes(key)) continue;
        }

        if (this.allowedProps.includes(key)) {
          filteredObject.select[key] = selectObject.select[key];
          continue;
        }

        const field = this.field(key, model);
        if (field) {
          if (field.kind !== 'object') {
            filteredObject.select[key] = true;
            continue;
          }

          const subModelFilter = this.filterBy(field.type, selectObject.select[key]);
          if (subModelFilter === true) {
            filteredObject.select[key] = true;
            continue;
          }

          if (Object.keys(subModelFilter.select).length > 0) {
            filteredObject.select[key] = subModelFilter;
          }
        }
      }
      return filteredObject;
    } else {
      return selectObject;
    }
  }

  private getArgs(args?: Record<string, unknown>) {
    const filteredArgs: Record<string, any> = {};
    if (args) {
      this.availableArgs.forEach((key) => {
        if (args[key]) {
          filteredArgs[key] = args[key];
        }
      });
    }
    return filteredArgs;
  }

  private getSelect(fields: PrismaSelect['fields'], parent = true) {
    const selectObject: any = this.isAggregate ? {} : { select: {}, ...(parent ? {} : this.getArgs(fields?.args)) };
    if (fields) {
      Object.keys(fields.fieldsByTypeName).forEach((type) => {
        const fieldsByTypeName = fields.fieldsByTypeName[type];
        Object.keys(fieldsByTypeName).forEach((key) => {
          const fieldName = fieldsByTypeName[key].name;
          if (Object.keys(fieldsByTypeName[key].fieldsByTypeName).length === 0) {
            if (this.isAggregate) {
              selectObject[fieldName] = true;
            } else {
              if (fields.name === '_count' && Object.keys(fieldsByTypeName[key].args).length) {
                selectObject.select[fieldName] = fieldsByTypeName[key].args;
              } else {
                selectObject.select[fieldName] = true;
              }
            }
          } else {
            if (this.isAggregate) {
              selectObject[fieldName] = this.getSelect(fieldsByTypeName[key], false);
            } else {
              selectObject.select[fieldName] = this.getSelect(fieldsByTypeName[key], false);
            }
          }
        });
      });
    }
    return selectObject;
  }
}
